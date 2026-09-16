import { cookies } from 'next/headers';
import { inviteCookie, redeemInvite } from '@/lib/audiobook-invite';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const headers = {'Cache-Control':'private, no-store'};
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response(null, {status:403, headers});
  if (Number(request.headers.get('content-length')) > 1024) return new Response(null,{status:413,headers});
  let token:unknown;
  try { token = (await request.json()).token; } catch { return new Response(null,{status:400,headers}); }
  const jar = await cookies();
  const result = await redeemInvite(token, jar.get(inviteCookie)?.value);
  if (!result) return Response.json({error:'Testlänken är ogiltig eller har gått ut. Kontakta Saltwaves för en ny länk.'},{status:403,headers});
  jar.set(inviteCookie, result.value, {httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', expires:result.expires});
  return Response.json({ok:true},{headers});
}
