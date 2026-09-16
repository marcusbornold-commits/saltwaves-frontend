import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
export const inviteCookie = 'sw-audiobook-guest';
function config() {
  const secret = process.env.AUDIOBOOK_INVITE_SECRET || '';
  const expires = Math.floor(Date.parse(process.env.AUDIOBOOK_INVITE_EXPIRES || '') / 1000);
  if (process.env.AUDIOBOOK_ENABLED !== 'true' || secret.length < 32 || !Number.isFinite(expires) || expires <= Date.now()/1000) return null;
  return { secret, expires, key: new TextEncoder().encode(secret) };
}
export async function readInvite(value?: string) {
  const c = config();
  if (!c || !value) return null;
  try {
    const { payload } = await jwtVerify(value, c.key, { algorithms: ['HS256'], issuer: 'audiobook-invite', audience: 'audiobook-guest' });
    if (!payload.sub?.startsWith('guest-') || typeof payload.exp !== 'number' || payload.exp > c.expires) return null;
    return payload.sub;
  } catch { return null; }
}
export async function redeemInvite(token: unknown, existing?: string) {
  const c = config();
  if (!c || typeof token !== 'string' || token.length > 256) return null;
  const hash = (s:string) => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(hash(token), hash(c.secret))) return null;
  const subject = await readInvite(existing) || `guest-${randomUUID()}`;
  const value = await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(subject).setIssuer('audiobook-invite').setAudience('audiobook-guest').setIssuedAt().setExpirationTime(c.expires).sign(c.key);
  return { value, expires: new Date(c.expires * 1000) };
}
