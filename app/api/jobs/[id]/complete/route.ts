import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { authorizedJob, checkOrigin, rpc, jobSummary, queueResponse, queueFailure, QueueError } from '@/lib/cloud-queue';
export const runtime = 'nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    checkOrigin(request);
    const job = await authorizedJob(request,(await params).id);
    if (job.status!=='uploading') return queueResponse(jobSummary(job));
    const {data,error} = await getSupabaseAdmin().storage.from(job.input_bucket).info(job.input_path);
    if (error || !data) throw new QueueError('upload_incomplete',409);
    const size = data.size;
    if (!Number.isSafeInteger(size) || size!==job.size_bytes) throw new QueueError('size_mismatch',400);
    const queued = await rpc('pm_enqueue_job',{p_id:job.id,p_size:size});
    // Attribution is best effort and independent of queue acceptance.
    if (queued.newly_queued && job.attribution?.first_touch_ms) {
      const first=job.attribution.first_touch_ms;
      await getSupabaseAdmin().from('upload_events').insert({job_id:job.id,user_id:job.owner_id,file_name:job.filename,
        tool:'loudness_inspector',first_touch_ms:first,first_touch_at:new Date(first).toISOString(),
        days_since_first_touch:Math.floor((Date.now()-first)/86400000)});
    }
    return queueResponse(jobSummary(queued));
  } catch(error) { return queueFailure(error); }
}
