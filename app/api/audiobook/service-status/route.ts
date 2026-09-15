import { getAudiobookStorage } from '@/lib/audiobook-storage-admin';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'no-store'};
 if(process.env.AUDIOBOOK_MONITOR_ENABLED!=='true') return Response.json({message:null},{headers});
 try {
  const {data,error}=await getAudiobookStorage().from('audiobook_monitor_state').select('incident,checked_at').eq('id','main').abortSignal(AbortSignal.timeout(5000)).maybeSingle();
  if(error || !data?.checked_at || Date.now()-Date.parse(data.checked_at)>15*60000) return Response.json({message:'Driftstatus kan inte kontrolleras just nu. Om en åtgärd misslyckas, försök igen om en stund.'},{headers});
  return Response.json({message:data.incident?'Vi har en driftstörning. Bearbetning och överföringar kan ta längre tid eller tillfälligt misslyckas. Vi kontrollerar tjänsten automatiskt.':null},{headers});
 } catch {return Response.json({message:'Driftstatus kan inte kontrolleras just nu. Försök igen om en stund om en åtgärd misslyckas.'},{headers});}
}
