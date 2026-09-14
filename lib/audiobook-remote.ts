import 'server-only';
import { SignJWT } from 'jose';
import { audiobookAccess } from './audiobook-access';
import { getAudiobookStorage } from './audiobook-storage-admin';
export const bucket = 'audiobook-private';
export const privateHeaders = {'Cache-Control':'private, no-store'};
export async function remoteAccess() {
  const {session,allowed}=await audiobookAccess();
  if(!session?.user?.id) throw new Response('Logga in för att fortsätta.',{status:401});
  if(!allowed) throw new Response('Ditt konto har inte tillgång till testet.',{status:403});
  const secret=process.env.AUDIOBOOK_TOKEN_SECRET || '';
  const base=process.env.AUDIOBOOK_SERVICE_URL || '';
  if(new TextEncoder().encode(secret).length<32 || !base.startsWith('https://')) throw new Error('Testet är inte aktiverat.');
  const token=await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(session.user.id).setIssuer('saltwaves-web').setAudience('saltwaves-audiobook').setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode(secret));
  return async (path:string,init:RequestInit={})=>{
    const headers=new Headers(init.headers);headers.set('Authorization',`Bearer ${token}`);
    const response=await fetch(base.replace(/\/$/,'')+path,{...init,headers,cache:'no-store',signal:AbortSignal.timeout(25000)});
    const data=await response.json();
    if(!response.ok) throw new Response(data.detail || 'Förfrågan kunde inte slutföras.',{status:response.status});
    return data;
  };
}
export async function signedAudio(path:string,id:string,download?:string,expires?:number) {
  if(!path.startsWith(id+'/') || path.includes('..')) throw new Error('Ogiltig filreferens.');
  const {data,error}=await getAudiobookStorage().storage.from(bucket).createSignedUrl(path,Math.max(1,Math.min(24*3600,Math.floor((expires || Date.now()/1000+24*3600)-Date.now()/1000))),download?{download}:undefined);
  if(error || !data) throw new Error('Filen kunde inte göras tillgänglig.');
  return data.signedUrl;
}
export async function remoteError(error:unknown) {
  return Response.json({error:error instanceof Response ? await error.text() : 'Anslutningen avbröts. Försök igen om en stund.'},{status:error instanceof Response?error.status:503,headers:privateHeaders});
}
