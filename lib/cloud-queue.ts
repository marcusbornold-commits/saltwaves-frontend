import 'server-only';
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { capability, validCapability, QueueError } from '@/lib/queue-validation';
export { capability, QueueError } from '@/lib/queue-validation';

export function cloudEnabled() { return process.env.PODMASTER_QUEUE_BACKEND === 'supabase'; }
export function secret() {
  const key = process.env.UPLOAD_TOKEN_SECRET;
  if (!key) throw new QueueError('service_unavailable', 503);
  return key;
}
export function checkOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new QueueError('invalid_origin', 403);
}
export function scopeHash(request: Request, userId?: string) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  return createHmac('sha256', secret()).update(userId ? 'user:'+userId : 'ip:'+ip).digest('hex');
}
export function queueResponse(data: unknown, status=200) {
  return NextResponse.json(data, { status, headers: {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'} });
}
export function queueFailure(error: unknown) {
  const code = error instanceof QueueError ? error.code : 'service_unavailable';
  const messages: Record<string,string> = {
    service_unavailable:'Upload is temporarily unavailable. Please try again shortly.',
    file_too_large:'This file exceeds your plan limit.', episode_too_long:'This episode exceeds your plan duration limit.',
    invalid_file_type:'Please choose a WAV, MP3 or M4A file.', invalid_email:'Enter a valid delivery email.',
    uploads_in_progress:'Finish your current uploads before starting another.', rate_limited:'Too many upload attempts. Please try again later.',
    upload_incomplete:'The upload has not finished yet. Please retry.', upload_expired:'This upload expired. Please start again.',
    job_not_found:'This job is unavailable or its link has expired.', size_mismatch:'The uploaded size does not match. Please start again.',
  };
  return queueResponse({error_code:code,message:messages[code] || 'The request could not be completed.'}, error instanceof QueueError ? error.status : 503);
}
export async function rpc(name: string, args: Record<string, unknown> = {}) {
  const {data,error} = await getSupabaseAdmin().rpc(name,args);
  if (error) {
    const known = ['uploads_in_progress','rate_limited','file_too_large','upload_expired','size_mismatch'];
    const code = known.find(k=>error.message.includes(k));
    if (code) throw new QueueError(code, code==='rate_limited' || code==='uploads_in_progress' ? 429 : 400);
    throw new QueueError('service_unavailable',503);
  }
  return data;
}
export async function authorizedJob(request: Request, id: string) {
  const token = new URL(request.url).searchParams.get('token') || request.headers.get('authorization')?.replace(/^Bearer /,'') || '';
  if (!validCapability(id,token,secret())) throw new QueueError('job_not_found',404);
  const {data,error} = await getSupabaseAdmin().from('podmaster_jobs').select('*').eq('id',id).maybeSingle();
  if (error) throw new QueueError('service_unavailable',503);
  if (!data || data.status==='expired' || Date.parse(data.expires_at)<=Date.now()) throw new QueueError('job_not_found',410);
  return data;
}
export function jobSummary(job: Record<string, unknown>) {
  const id = String(job.id);
  return {job_id:id,status:job.status,tier:job.tier,filename:job.filename,expires_at:job.expires_at,error_code:job.error_code,
    status_url:'/api/jobs/'+id+'?token='+capability(id,secret())};
}
