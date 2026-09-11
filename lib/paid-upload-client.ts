import { Upload } from 'tus-js-client';
import type { MicType, UploadResult } from './upload-client';

class PaidUploadError extends Error {
  constructor(message: string, readonly code?: string) {super(message);}
}

async function api(path: string, body: unknown, method='POST') {
  const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await response.json();
  if(!response.ok) throw new PaidUploadError(data.message ?? 'Upload is temporarily unavailable. Please try again.',data.error_code);
  return data;
}

export async function uploadPaidAudio(file: File, mic: MicType, email: string, duration: number|null, scope: string,
  onProgress?: (loaded:number,total:number)=>void, signal?: AbortSignal): Promise<UploadResult> {
  if(signal?.aborted) throw new DOMException('Upload cancelled','AbortError');
  const sample=new Uint8Array(await new Blob([file.slice(0,65536),file.slice(Math.max(65536,file.size-65536))]).arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',sample))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const fingerprint=JSON.stringify([scope,file.name,file.size,file.lastModified,email,mic,hash]);
  const key='podmaster-upload:'+fingerprint;
  let id: string;
  try{id=sessionStorage.getItem(key) ?? crypto.randomUUID();sessionStorage.setItem(key,id);}catch{id=crypto.randomUUID();}
  const clear=()=>{try{sessionStorage.removeItem(key);}catch{/* Storage may be disabled. */}};
  let upload: Upload | undefined;
  let cancelled=false;
  const cancel=()=>{
    cancelled=true;
    void upload?.abort(true).catch(()=>{});
    clear();
    void api('/api/queue/uploads/'+id,{},'DELETE').catch(()=>{});
  };
  signal?.addEventListener('abort',cancel,{once:true});
  try {
    const grant=await api('/api/queue/uploads',{id,filename:file.name,size:file.size,email,mic,duration});
    if(cancelled || signal?.aborted) {
      // The grant may have been created after the cancellation request arrived.
      await api('/api/queue/uploads/'+id,{},'DELETE').catch(()=>{});
      throw new DOMException('Upload cancelled','AbortError');
    }
    if(grant.status!=='uploading') {clear();return grant;}
    try { await new Promise<void>((resolve,reject)=>{
      const onAbort=()=>reject(new DOMException('Upload cancelled','AbortError'));
      const finish=(error?: Error)=>{signal?.removeEventListener('abort',onAbort);if(error) reject(error);else resolve();};
      signal?.addEventListener('abort',onAbort,{once:true});
      upload=new Upload(file,{
        endpoint:grant.endpoint,headers:{'x-signature':grant.token},
        chunkSize:6*1024*1024,uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
        retryDelays:[0,1000,3000,5000,10000,20000],
        metadata:{bucketName:grant.bucket,objectName:grant.path,contentType:file.type||'application/octet-stream'},
        fingerprint:async()=>`podmaster:${scope}:${id}`,
        onProgress:(loaded,total)=>onProgress?.(loaded,total),
        onError:()=>finish(new Error('The upload was interrupted. Press Start mastering to resume it.')),
        onSuccess:()=>finish(),
      });
      void upload.findPreviousUploads().then(previous=>{
        if(cancelled || signal?.aborted) return finish(new DOMException('Upload cancelled','AbortError'));
        if(previous[0]) upload!.resumeFromPreviousUpload(previous[0]);
        upload!.start();
      }).catch(()=>finish(new Error('Could not resume this upload. Please try again.')));
    }); } catch(error) {
      if(cancelled || signal?.aborted) throw new DOMException('Upload cancelled','AbortError');
      // A lost final TUS response must not turn a fully stored file into a new job.
      try {const result=await api('/api/queue/uploads/'+id,{});clear();return result;} catch {throw error;}
    }
    if(cancelled || signal?.aborted) throw new DOMException('Upload cancelled','AbortError');
    const result=await api('/api/queue/uploads/'+id,{});
    clear();return result;
  } catch(error) {
    if(error instanceof PaidUploadError && ['upload_expired','upload_conflict','size_mismatch','job_not_found'].includes(error.code ?? '')) clear();
    throw error;
  } finally {signal?.removeEventListener('abort',cancel);}
}
