import { timingSafeEqual } from 'node:crypto';
import { reapPaidInputs } from '@/lib/paid-storage';
import { uploadJson } from '@/lib/upload-api-response';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request: Request) {
  const expected=Buffer.from('Bearer '+(process.env.CRON_SECRET ?? ''));
  const supplied=Buffer.from(request.headers.get('authorization') ?? '');
  if(!process.env.CRON_SECRET || supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return uploadJson({error:'unauthorized'},401);
  try{return uploadJson(await reapPaidInputs());}
  catch{return uploadJson({error:'cleanup_unavailable'},503);}
}
