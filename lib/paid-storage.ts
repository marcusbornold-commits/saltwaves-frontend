import 'server-only';
import { createHmac } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { PAID_INPUT_BUCKET, type UploadDraft } from '@/lib/paid-upload-validation';
import type { AccessLevel } from '@/lib/access-limits';

export function paidStorageEnabled(userId: string, access: AccessLevel): boolean {
  if (!access.isPaid || process.env.PODMASTER_QUEUE_BACKEND !== 'supabase') return false;
  const mode=process.env.PODMASTER_PAID_UPLOADS;
  return mode === 'on' || (mode === 'canary' && (process.env.PODMASTER_PAID_UPLOAD_TEST_USERS ?? '').split(',').map(x=>x.trim()).includes(userId));
}

export function storageEndpoint() {
  const url=new URL(process.env.SUPABASE_URL!);
  if (!url.hostname.endsWith('.supabase.co')) throw new Error('service_unavailable');
  url.hostname=url.hostname.replace('.supabase.co','.storage.supabase.co');
  url.pathname='/storage/v1/upload/resumable/sign';
  return url.toString();
}

export async function ownedUpload(id: string, userId: string) {
  const {data,error}=await getSupabaseAdmin().from('podmaster_jobs').select('*').eq('id',id).eq('owner_id',userId).eq('input_bucket',PAID_INPUT_BUCKET).maybeSingle();
  if(error) throw new Error('service_unavailable');
  return data;
}

export async function beginPaidUpload(draft: UploadDraft, userId: string, access: AccessLevel) {
  const db=getSupabaseAdmin();
  // Existing drafts remain resumable during a transport rollback.
  let job=await ownedUpload(draft.id,userId);
  if (!job) {
    if (!paidStorageEnabled(userId,access)) throw new Error('storage_disabled');
    const secret=process.env.UPLOAD_TOKEN_SECRET;
    if(!secret) throw new Error('service_unavailable');
    const {data,error}=await db.rpc('pm_create_paid_job',{
      p_id:draft.id,p_owner:userId,p_scope:createHmac('sha256',secret).update('user:'+userId).digest('hex'),
      p_filename:draft.filename,p_size:draft.size,p_email:draft.email,p_tier:access.plan,p_mic:draft.mic,p_duration:draft.duration,
    });
    if(error) {
      for(const code of ['uploads_in_progress','rate_limited','upload_conflict']) if(error.message.includes(code)) throw new Error(code);
      throw new Error('service_unavailable');
    }
    job=data;
  }
  if(job.filename!==draft.filename || job.size_bytes!==draft.size || job.email!==draft.email || job.mic_type!==draft.mic) throw new Error('upload_conflict');
  if(['queued','processing','done'].includes(job.status)) return {job_id:job.id,status:job.status};
  if(job.status!=='uploading' || Date.parse(job.created_at)+2*3600_000<=Date.now()) throw new Error('upload_expired');
  // A previous successful upload may have lost its completion response. Do not
  // attempt to overwrite it or create another job on the customer's retry.
  const {data:existing,error:infoError}=await db.storage.from(PAID_INPUT_BUCKET).info(job.input_path);
  if(existing) return finishPaidUpload(job.id,userId);
  if(infoError && (!('statusCode' in infoError) || !['404','400'].includes(String(infoError.statusCode)))) throw new Error('service_unavailable');
  // Keys are server-assigned; only one immutable object per job. Never allow upsert.
  const {data,error}=await db.storage.from(PAID_INPUT_BUCKET).createSignedUploadUrl(job.input_path,{upsert:false});
  if(error || !data) throw new Error('service_unavailable');
  return {job_id:job.id,status:'uploading',endpoint:storageEndpoint(),bucket:PAID_INPUT_BUCKET,path:job.input_path,token:data.token};
}

export async function finishPaidUpload(id: string, userId: string) {
  const db=getSupabaseAdmin();
  const job=await ownedUpload(id,userId);
  if(!job) throw new Error('job_not_found');
  if(['queued','processing','done'].includes(job.status)) return {job_id:id,status:job.status};
  if(job.status!=='uploading' || Date.parse(job.created_at)+2*3600_000<=Date.now()) throw new Error('upload_expired');
  const {data:object,error}=await db.storage.from(PAID_INPUT_BUCKET).info(job.input_path);
  if(error || !object) throw new Error('upload_incomplete');
  if(object.size!==job.size_bytes) throw new Error('size_mismatch');
  const {data,error:queueError}=await db.rpc('pm_enqueue_job',{p_id:id,p_size:object.size});
  if(queueError) throw new Error(queueError.message.includes('upload_expired')?'upload_expired':'service_unavailable');
  if(!['queued','processing','done'].includes(data.status)) throw new Error('upload_expired');
  return {job_id:id,status:data.status};
}

export async function reapPaidInputs() {
  const db=getSupabaseAdmin();
  const {error:expiryError}=await db.rpc('pm_expire_paid_uploads');
  if(expiryError) throw new Error('expiry_unavailable');
  const {data:jobs,error}=await db.rpc('pm_paid_inputs_to_reap');
  if(error) throw new Error('cleanup_unavailable');
  let removed=0;
  for(const job of jobs ?? []) {
    if(job.input_bucket!==PAID_INPUT_BUCKET || !new RegExp('^'+job.id+'/input\\.(wav|mp3|m4a)$').test(job.input_path)) throw new Error('invalid_storage_path');
    const {error:removeError}=await db.storage.from(PAID_INPUT_BUCKET).remove([job.input_path]);
    if(removeError) throw new Error('storage_cleanup_unavailable');
    const {error:markError}=await db.from('podmaster_jobs').update({input_deleted_at:new Date().toISOString()}).eq('id',job.id).in('status',['done','failed','expired']);
    if(markError) throw new Error('cleanup_unavailable');
    removed++;
  }
  return {checked:removed};
}
