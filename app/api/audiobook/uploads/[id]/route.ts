import { remoteAccess, remoteError, privateHeaders } from '@/lib/audiobook-remote';
export const dynamic='force-dynamic';
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const remote=await remoteAccess();const {id}=await params;
    if(!/^[a-f0-9]{32}$/.test(id)) return new Response(null,{status:404});
    return Response.json(await remote(`/cloud-jobs/${id}/complete`,{method:'POST'}),{headers:privateHeaders});
  }catch(error){return remoteError(error);}
}

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const remote=await remoteAccess();const {id}=await params;
    if(!/^[a-f0-9]{32}$/.test(id)) return new Response(null,{status:404});
    if(Number(request.headers.get('content-length'))>4096) return new Response(null,{status:413});
    const body=await request.json();
    return Response.json(await remote(`/jobs/${id}/run`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':body.key||''},body:JSON.stringify({target:body.target,mode:body.mode,start:body.start,duration:body.duration})}),{headers:privateHeaders});
  }catch(error){return remoteError(error);}
}
