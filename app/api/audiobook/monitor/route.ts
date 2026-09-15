import { timingSafeEqual } from 'node:crypto';
import { getAudiobookStorage, audiobookStorageUrl } from '@/lib/audiobook-storage-admin';
import { healthIssues, type MiniHealth } from '@/lib/audiobook-monitor-checks';
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
  const checks=await Promise.allSettled([
    fetch((process.env.AUDIOBOOK_SERVICE_URL || '').replace(/\/$/,'')+'/health',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok || !(await r.json()).ok) throw new Error();}),
    fetch('https://app.saltwaves.studio/login?callbackUrl=%2Ftools%2Faudiobook',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok || !(await r.text()).includes('Sign in')) throw new Error();}),
    db.from('audiobook_monitor_health').select('checked_at,data').eq('id','mini').abortSignal(AbortSignal.timeout(10000)).maybeSingle().then(r=>{if(r.error) throw r.error;return r.data;}),
    db.storage.getBucket('audiobook-private').then(r=>{if(r.error || !r.data || r.data.public) throw new Error();})
  ]);
  if(checks[0].status==='rejected') issues.push('Mastringstjänsten på Mac Mini svarar inte normalt.');
  if(checks[1].status==='rejected') issues.push('Webbplatsens inloggningssida svarar inte normalt.');
  if(checks[3].status==='rejected') issues.push('Den privata ljudlagringen kan inte verifieras.');
  if(checks[2].status==='fulfilled') issues.push(...healthIssues(checks[2].value?.data as MiniHealth|null,checks[2].value?.checked_at || null));
  else issues.push('Supabase-databasen eller övervakningens tabeller är otillgängliga.');
  try {
    const {error}=await db.rpc('record_audiobook_monitor',{p_issues:issues,p_check_id:String(Math.floor(Date.now()/300000))}).abortSignal(AbortSignal.timeout(10000));
    if(error) throw error;
  } catch {
    // State storage is unavailable: one stable fallback warning per UTC day.
    try {await email(`audiobook-monitor-storage-${new Date().toISOString().slice(0,10)}`,'Saltwaves: övervakningens databas kan inte nås',
      'Driftövervakningen kan inte läsa eller spara status i Audiobooks Supabase-databas. Kontrollera Supabase. Automatiska kontroller fortsätter. Detta reservlarm skickas högst en gång per UTC-dygn. Återställningsmejl kan inte garanteras för detta reservlarm.');}
    catch {return Response.json({error:'monitor_and_notification_failed'},{status:503,headers});}
    return Response.json({error:'monitor_state_unavailable'},{status:503,headers});
  }
  const pending=await db.from('audiobook_monitor_notifications').select('id,kind,issues').is('sent_at',null).order('created_at').limit(4);
  if(pending.error) return Response.json({error:'notification_queue_unavailable'},{status:503,headers});
  let sent=0;
  for(const item of pending.data || []) {
    try {
      const recovery=item.kind==='recovery', test=item.kind==='test';
      await email(`audiobook-monitor-${item.id}`,test?'Saltwaves: test av driftlarm':recovery?'Saltwaves: driften fungerar igen':'Saltwaves: driftstörning i Audiobook',
        test?'Detta är ett test av Audiobooks nya driftövervakning. Ingen driftstörning har skapats. Du får mejl när tre kontroller i följd visar fel och när två efterföljande kontroller visar normal drift.':recovery?'Två kontroller i följd visar normal drift i Audiobook. Ingen manuell omstart har gjorts av övervakningen.':
        'Tre kontroller i följd visar en driftstörning:\n\n'+item.issues.join('\n')+'\n\nAutomatik: befintlig processövervakning startar kraschade tjänster, och nätöverföringar samt jobbsynkning försöker igen. Pågående mastringar startas inte om av detta larm. Kontrollera Mac Mini, nätanslutningen och jobböversikten i Supabase.\n\nhttps://supabase.com/dashboard/project/xuxqrkposxrvhwvwjroc/editor/17494?schema=public');
      const saved=await db.from('audiobook_monitor_notifications').update({sent_at:new Date().toISOString()}).eq('id',item.id);
      if(saved.error) throw saved.error;
      sent++;
    } catch {return Response.json({error:'notification_pending_retry'},{status:503,headers});}
  }
  return Response.json({ok:issues.length===0,issues,notificationsSent:sent},{headers});
}
