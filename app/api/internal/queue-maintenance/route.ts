import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { OUTPUT_BUCKET } from '@/lib/queue-validation';
import { rpc, queueResponse, queueFailure, QueueError } from '@/lib/cloud-queue';
export const runtime='nodejs';
export const maxDuration=300;
async function removeFolder(bucket:string,prefix:string) {
  const storage=getSupabaseAdmin().storage.from(bucket);
  // Each job has one input and at most three attempt folders. Never scan another job's prefix.
  for (;;) {
    const {data,error}=await storage.list(prefix,{limit:100});
    if(error) throw new QueueError('cleanup_unavailable',503);
    if(!data?.length) return;
    for(const item of data) {
      const path=prefix+'/'+item.name;
      if(!item.id) await removeFolder(bucket,path);
      else {
        const {error:removeError}=await storage.remove([path]);
        if(removeError) throw new QueueError('cleanup_unavailable',503);
      }
    }
  }
}
export async function GET(request:Request) {
  try {
    const key=process.env.CRON_SECRET;
    const supplied=request.headers.get('authorization') || '';
    const expected='Bearer '+key;
    if(!key || supplied.length!==expected.length || !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) throw new QueueError('unauthorized',401);
    const jobs=await rpc('pm_expire_jobs');
    let cleaned=0;
    for(const job of jobs || []) {
      await removeFolder(job.input_bucket,job.id);
      await removeFolder(OUTPUT_BUCKET,job.id);
      const {error}=await getSupabaseAdmin().from('podmaster_jobs').update({files_deleted_at:new Date().toISOString(),email:'',filename:'expired',owner_id:null,scope_hash:'',attribution:null,result:null}).eq('id',job.id).eq('status','expired');
      if(error) throw new QueueError('cleanup_unavailable',503);
      cleaned++;
    }
    return queueResponse({ok:true,cleaned});
  } catch(error) { return queueFailure(error); }
}
