import { Upload } from 'tus-js-client';
import { UploadError, type UploadResult } from './upload-client';

async function jsonResponse(response: Response) {
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new UploadError(body.message || 'Upload could not be completed. Please try again.',body.error_code);
  return body;
}
export async function cloudUpload(file:File,micType:string,email:string,duration:number|null,attribution:unknown,onProgress?: (loaded:number,total:number)=>void):Promise<UploadResult> {
  const grant=await jsonResponse(await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:file.name,size:file.size,email,mic_type:micType,duration_seconds:duration,...(attribution || {})})}));
  await new Promise<void>((resolve,reject)=>{
    const upload=new Upload(file,{
      endpoint:grant.upload.endpoint,
      headers:{'x-signature':grant.upload.signature},
      metadata:{bucketName:grant.upload.bucket,objectName:grant.upload.path,contentType:file.type || 'application/octet-stream',cacheControl:'0'},
      chunkSize:6*1024*1024,
      retryDelays:[0,1000,3000,5000,10000],
      uploadDataDuringCreation:true,
      removeFingerprintOnSuccess:true,
      // Never resume another job's URL/token from a previous browser attempt.
      storeFingerprintForResuming:false,
      onProgress:(sent,total)=>onProgress?.(sent,total),
      onError:()=>reject(new UploadError('The upload was interrupted. Please try again.','upload_interrupted')),
      onSuccess:()=>resolve(),
    });
    upload.start();
  });
  // A completion request can safely be repeated after a lost network response.
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      return await jsonResponse(await fetch('/api/jobs/'+grant.job_id+'/complete',{
        method:'POST',headers:{Authorization:'Bearer '+grant.job_token},
      }));
    } catch(error) {
      lastError=error;
      if(error instanceof UploadError && ['size_mismatch','upload_expired','job_not_found'].includes(error.errorCode || '')) throw error;
      if(attempt<2) await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
    }
  }
  throw lastError;
}
