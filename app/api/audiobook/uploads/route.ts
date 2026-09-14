import { remoteAccess, remoteError, bucket, privateHeaders } from '@/lib/audiobook-remote';
import { getAudiobookStorage, audiobookStorageUrl } from '@/lib/audiobook-storage-admin';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  try {
    const remote=await remoteAccess();
    if(Number(request.headers.get('content-length'))>4096) return new Response(null,{status:413});
    const body=await request.json();
    const job=await remote('/cloud-jobs',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':body.key || ''},body:JSON.stringify({filename:body.filename,target:body.target,size:body.size,mode:body.mode,start:body.start,duration:body.duration})});
    if(job.status!=='uploading') return Response.json(job,{headers:privateHeaders});
    const {data,error}=await getAudiobookStorage().storage.from(bucket).createSignedUploadUrl(job.path);
    if(error || !data) throw new Error('Upload grant failed');
    const url=new URL(audiobookStorageUrl().url);
    url.hostname=url.hostname.replace('.supabase.co','.storage.supabase.co');
    return Response.json({...job,bucket,token:data.token,endpoint:url.origin+'/storage/v1/upload/resumable/sign'},{headers:privateHeaders});
  }catch(error){return remoteError(error);}
}
