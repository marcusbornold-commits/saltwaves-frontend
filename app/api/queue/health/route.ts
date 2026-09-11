import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { auth } from '@/auth';
import { getAccess } from '@/lib/access';
import { paidStorageEnabled } from '@/lib/paid-storage';
export const runtime='nodejs';
export async function GET() {
  const backend=process.env.PODMASTER_QUEUE_BACKEND==='supabase' ? 'supabase' : 'legacy';
  if(backend==='legacy') return NextResponse.json({backend,ok:true},{headers:{'Cache-Control':'no-store'}});
  try {
    const {error}=await getSupabaseAdmin().from('podmaster_jobs').select('id',{head:true}).limit(1);
    const session=await auth();
    const userId=session?.user?.id;
    const storage=userId ? paidStorageEnabled(userId,await getAccess(userId)) : false;
    return NextResponse.json({backend,ok:!error,transport:storage?'storage':'mini',uploadScope:storage?userId:undefined},{status:error?503:200,headers:{'Cache-Control':'private, no-store'}});
  } catch {return NextResponse.json({backend,ok:false},{status:503,headers:{'Cache-Control':'no-store'}});}
}
