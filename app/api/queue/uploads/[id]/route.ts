import { auth } from '@/auth';
import { isJobId } from '@/lib/paid-upload-validation';
import { finishPaidUpload,ownedUpload } from '@/lib/paid-storage';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { uploadBody,uploadFailure,uploadJson } from '@/lib/upload-api-response';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function POST(request: Request,context: Context) {
  try {
    await uploadBody(request);
    const session=await auth();const {id}=await context.params;
    if(!session?.user?.id) throw new Error('unauthenticated');
    if(!isJobId(id)) throw new Error('invalid_request');
    return uploadJson(await finishPaidUpload(id,session.user.id));
  }catch(error){return uploadFailure(error);}
}
export async function DELETE(request: Request,context: Context) {
  try {
    await uploadBody(request);
    const session=await auth();const {id}=await context.params;
    if(!session?.user?.id) throw new Error('unauthenticated');
    if(!isJobId(id)) throw new Error('invalid_request');
    if(!await ownedUpload(id,session.user.id)) throw new Error('job_not_found');
    const {data,error}=await getSupabaseAdmin().rpc('pm_cancel_paid_upload',{p_id:id,p_owner:session.user.id});
    if(error) throw new Error('service_unavailable');
    return uploadJson({cancelled:data});
  }catch(error){return uploadFailure(error);}
}
