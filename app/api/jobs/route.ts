import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { getAccess } from '@/lib/access';
import { FREE_ACCESS } from '@/lib/access-limits';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { validateUpload } from '@/lib/queue-validation';
import { cloudEnabled, checkOrigin, scopeHash, rpc, jobSummary, capability, secret, queueResponse, queueFailure, QueueError } from '@/lib/cloud-queue';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    if (!cloudEnabled()) throw new QueueError('service_unavailable',503);
    checkOrigin(request);
    if (Number(request.headers.get('content-length') || 0)>8192) throw new QueueError('invalid_request');
    const raw = await request.text();
    if (raw.length>8192) throw new QueueError('invalid_request');
    let body;
    try { body = JSON.parse(raw); } catch { throw new QueueError('invalid_request'); }
    const session = await auth();
    const owner = session?.user?.id;
    const access = owner ? await getAccess(owner) : FREE_ACCESS;
    const data = validateUpload(body,access);
    const id = randomUUID();
    const firstTouch = typeof body.first_touch_ms==='number' && Number.isSafeInteger(body.first_touch_ms) && body.first_touch_ms>0 && body.first_touch_ms<=Date.now() ? body.first_touch_ms : null;
    const job = await rpc('pm_create_job',{p_id:id,p_owner:owner || null,p_scope:scopeHash(request,owner),p_filename:data.filename,p_size:data.size,p_email:data.email,p_tier:access.plan,p_mic:data.mic,p_duration:data.duration,p_attribution:firstTouch ? {first_touch_ms:firstTouch} : null});
    const {data:signed,error} = await getSupabaseAdmin().storage.from(job.input_bucket).createSignedUploadUrl(job.input_path,{upsert:false});
    if (error || !signed) throw new QueueError('service_unavailable',503);
    const url = new URL(process.env.SUPABASE_URL!);
    if (url.hostname.endsWith('.supabase.co')) url.hostname = url.hostname.replace('.supabase.co','.storage.supabase.co');
    return queueResponse({...jobSummary(job),job_token:capability(id,secret()),upload:{endpoint:url.origin+'/storage/v1/upload/resumable/sign',bucket:job.input_bucket,path:job.input_path,signature:signed.token}},201);
  } catch (error) { return queueFailure(error); }
}
