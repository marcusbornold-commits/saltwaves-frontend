import 'server-only';
import {getAudiobookStorage} from './audiobook-storage-admin';
export async function assertAudiobookCapacity() {
 if(process.env.AUDIOBOOK_MONITOR_ENABLED!=='true') return;
 const {data,error}=await getAudiobookStorage().from('audiobook_monitor_health').select('checked_at,data').eq('id','mini').abortSignal(AbortSignal.timeout(5000)).maybeSingle();
 if(!error && data && Date.now()-Date.parse(data.checked_at)<300000 && data.data.diskFreeBytes<5*1024**3)
  throw new Response('Nya körningar är tillfälligt pausade eftersom lagringsutrymmet är lågt. Försök igen senare.',{status:503});
}
