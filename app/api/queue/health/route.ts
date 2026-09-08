import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { cloudEnabled, queueResponse } from '@/lib/cloud-queue';
export const runtime = 'nodejs';
export async function GET() {
  if (!cloudEnabled()) return queueResponse({backend:'legacy',ok:true});
  try {
    const {error}=await getSupabaseAdmin().from('podmaster_jobs').select('id',{head:true,count:'estimated'}).limit(1);
    return queueResponse({backend:'supabase',ok:!error},error?503:200);
  } catch { return queueResponse({backend:'supabase',ok:false},503); }
}
