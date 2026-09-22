import { timingSafeEqual } from 'node:crypto';
import { getAudiobookStorage, audiobookStorageUrl } from '@/lib/audiobook-storage-admin';
import { healthIssues, retryMonitorOperation, checkMiniService, miniServiceIssue, type MiniHealth } from '@/lib/audiobook-monitor-checks';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
async function email(key:string,subject:string,text:string) {
  const token=process.env.AUTH_RESEND_KEY;
  if(!token) throw new Error('Mail configuration missing');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify({from:'Saltwaves drift <login@send.saltwaves.studio>',to:['marcus@saltwaves.studio'],subject,text}),signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error('Alert delivery failed');
}
export async function GET(request:Request) {
  const secret=process.env.CRON_SECRET || '';
  const expected=Buffer.from(`Bearer ${secret}`),supplied=Buffer.from(request.headers.get('authorization') || '');
  if(secret.length<32 || supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return Response.json({error:'unauthorized'},{status:401,headers});
  if(process.env.AUDIOBOOK_MONITOR_ENABLED!=='true') return Response.json({enabled:false},{headers});
  if(audiobookStorageUrl().url.replace(/\/$/,'')!=='https://xuxqrkposxrvhwvwjroc.supabase.co') return Response.json({error:'wrong_project'},{status:503,headers});
  const db=getAudiobookStorage();
  const issues:string[]=[];
  const checkId=String(Math.floor(Date.now()/300000));
  const checks=await Promise.allSettled([
    checkMiniService((process.env.AUDIOBOOK_SERVICE_URL || '').replace(/\/$/,'')+'/health'),
    fetch('https://app.saltwaves.studio/login?callbackUrl=%2Ftools%2Faudiobook',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok || !(await r.text()).includes('Sign in')) throw new Error();}),
    retryMonitorOperation(()=>db.from('audiobook_monitor_health').select('checked_at,data').eq('id','mini').abortSignal(AbortSignal.timeout(6000)).maybeSingle().then(r=>{if(r.error) throw r.error;return r.data;}),'health_read'),
    retryMonitorOperation(async()=>{
      const {url,key}=audiobookStorageUrl();
      const r=await fetch(url.replace(/\/$/,'')+'/storage/v1/bucket/audiobook-private',{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store',signal:AbortSignal.timeout(6000)});
      if(!r.ok) {await r.body?.cancel();throw new Error('bucket_request_failed');}
      const bucket=await r.json();if(bucket.public!==false) throw new Error('bucket_not_private');
    },'bucket_read')
  ]);
  const service = checks[0].status === 'fulfilled' ? checks[0].value : { ok: false, attempts: [] };
  const mini = checks[2].status === 'fulfilled' ? checks[2].value : null;
  const serviceIssue = miniServiceIssue(service.ok, mini?.data as MiniHealth | null, mini?.checked_at || null);
  if (serviceIssue) issues.push(serviceIssue);
  // Persist safe probe details in the hosting logs, including recovered first attempts.
  console.info('audiobook_monitor_probe', JSON.stringify({ checkedAt: new Date().toISOString(), service,
    miniCheckedAt: mini?.checked_at || null, workerAgeSeconds: mini?.data?.workerAgeSeconds ?? null, serviceIssue }));
  if(checks[1].status==='rejected') issues.push('Webbplatsens inloggningssida svarar inte normalt.');
  if(checks[3].status==='rejected') issues.push('Den privata ljudlagringen kan inte verifieras.');
  if(checks[2].status==='fulfilled') issues.push(...healthIssues(checks[2].value?.data as MiniHealth|null,checks[2].value?.checked_at || null));
  else issues.push('Supabase-databasen eller övervakningens tabeller är otillgängliga.');
  try {
    await retryMonitorOperation(()=>db.rpc('record_audiobook_monitor',{p_issues:issues,p_check_id:checkId})
      .abortSignal(AbortSignal.timeout(6000)).then(r=>{if(r.error) throw r.error;}),'state_record');
  } catch {
    // Independent Mini watchdog stores this incident outside Supabase and sends recovery mail.
    // Never generate calendar-based fallback keys: an unchanged incident is not a new outage.
    return Response.json({error:'monitor_state_unavailable'},{status:503,headers});
  }
  const pending=await db.from('audiobook_monitor_notifications').select('id,kind,issues').is('sent_at',null).order('created_at').limit(1).abortSignal(AbortSignal.timeout(6000));
  if(pending.error) return Response.json({error:'notification_queue_unavailable'},{status:503,headers});
  let sent=0;
  for(const item of pending.data || []) {
    try {
      const recovery=item.kind==='recovery', test=item.kind==='test';
      await email(`audiobook-monitor-${item.id}`,test?'Saltwaves: test av driftlarm':recovery?'Saltwaves: driften fungerar igen':'Saltwaves: driftstörning i Audiobook',
        test?'Detta är ett test av Audiobooks nya driftövervakning. Ingen driftstörning har skapats. Du får mejl när tre kontroller i följd visar fel och när två efterföljande kontroller visar normal drift.':recovery?'Två kontroller i följd visar normal drift i Audiobook. Ingen manuell omstart har gjorts av övervakningen.':
        'Tre kontroller i följd visar en driftstörning:\n\n'+item.issues.join('\n')+'\n\nAutomatik: befintlig processövervakning startar kraschade tjänster, och nätöverföringar samt jobbsynkning försöker igen. Pågående mastringar startas inte om av detta larm. Kontrollera Mac Mini, nätanslutningen och jobböversikten i Supabase.\n\nhttps://supabase.com/dashboard/project/xuxqrkposxrvhwvwjroc/editor/17494?schema=public');
      const saved=await db.from('audiobook_monitor_notifications').update({sent_at:new Date().toISOString()}).eq('id',item.id).abortSignal(AbortSignal.timeout(6000));
      if(saved.error) throw saved.error;
      sent++;
    } catch {return Response.json({error:'notification_pending_retry'},{status:503,headers});}
  }
  return Response.json({ok:issues.length===0,issues,notificationsSent:sent},{headers});
}
