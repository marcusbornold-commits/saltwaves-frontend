import {Upload} from 'tus-js-client';
export async function audiobookFetch(path:string,init:RequestInit={}):Promise<Response>{return fetch(path,init);}
export async function audiobookCloud():Promise<boolean>{
  const response=await fetch('/api/audiobook/access',{cache:'no-store'});
  const data=await response.json();if(!response.ok) throw new Error(data.error || 'Åtkomst kunde inte kontrolleras.');
  return !!data.cloud;
}
async function control(path:string,body:unknown,method="POST"){
  const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok) throw Object.assign(new Error(data.error || 'Förfrågan kunde inte slutföras.'),{status:response.status});return data;
}
export type Operation = {mode:"master"|"preview"|"validate";start:number;duration:number};
export async function reuseAudiobook(id:string,target:number,key:string,operation:Operation){return control(`/api/audiobook/uploads/${id}`,{target,key,...operation},"PUT");}
export async function uploadAudiobook(file:File,target:number,key:string,progress:(bytes:number,total:number)=>void,operation:Operation={mode:"master",start:0,duration:300}){
  const sample=await new Blob([file.slice(0,65536),file.slice(Math.max(65536,file.size-65536))]).arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',sample))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const storageKey='audiobook-resume:'+JSON.stringify([file.name,file.size,file.lastModified,target,hash,operation]);
  try{key=localStorage.getItem(storageKey)||key;localStorage.setItem(storageKey,key);}catch{/* Resuming in this tab still works. */}
  const clear=()=>{try{localStorage.removeItem(storageKey);}catch{/* Storage may be unavailable. */}};
  let grant;
  try { grant=await control('/api/audiobook/uploads',{filename:file.name,size:file.size,target,key,...operation}); }
  catch(error) {
    if(error instanceof Error && 'status' in error && error.status===410) clear();
    throw error;
  }
  if(grant.status!=='uploading') {clear();return grant;}
  try {
    await new Promise<void>((resolve,reject)=>{
      const upload=new Upload(file,{endpoint:grant.endpoint,headers:{'x-signature':grant.token},chunkSize:6*1024*1024,uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,retryDelays:[0,1000,3000,5000,10000,20000],metadata:{bucketName:grant.bucket,objectName:grant.path,contentType:file.type||'application/octet-stream'},fingerprint:async()=>`audiobook:${grant.id}`,onProgress:progress,onError:()=>reject(new Error('Uppladdningen avbröts. Tryck på samma åtgärd för att återuppta den.')),onSuccess:()=>resolve()});
      void upload.findPreviousUploads().then(previous=>{if(previous[0]) upload.resumeFromPreviousUpload(previous[0]);upload.start();}).catch(reject);
    });
  }catch(error){
    try{const result=await control(`/api/audiobook/uploads/${grant.id}`,{});clear();return result;}catch{throw error;}
  }
  const result=await control(`/api/audiobook/uploads/${grant.id}`,{});clear();return result;
}
