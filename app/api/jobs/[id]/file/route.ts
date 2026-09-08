import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { OUTPUT_BUCKET } from '@/lib/queue-validation';
import { authorizedJob, queueFailure, QueueError } from '@/lib/cloud-queue';
export const runtime = 'nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const job = await authorizedJob(request,(await params).id);
    const kind = new URL(request.url).searchParams.get('kind') || 'mastered';
    if (!['mastered','mastered_preview','original_preview'].includes(kind) || job.status!=='done') throw new QueueError('job_not_found',404);
    const path=job.result?.[kind];
    if (typeof path!=='string' || !path.startsWith(job.id+'/')) throw new QueueError('job_not_found',404);
    const ttl=Math.min(60,Math.floor((Date.parse(job.expires_at)-Date.now())/1000));
    if (ttl<=0) throw new QueueError('job_not_found',410);
    const filename=String(job.filename).replace(/\.[^.]+$/,'')+'_mastered.wav';
    const {data,error}=await getSupabaseAdmin().storage.from(OUTPUT_BUCKET).createSignedUrl(path,ttl,kind==='mastered' ? {download:filename} : {});
    if(error || !data) throw new QueueError('service_unavailable',503);
    return NextResponse.redirect(data.signedUrl,{status:307,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  } catch(error) { return queueFailure(error); }
}
