import { auth } from '@/auth';
import { getAccess } from '@/lib/access';
import { validateUploadDraft } from '@/lib/paid-upload-validation';
import { beginPaidUpload } from '@/lib/paid-storage';
import { uploadBody,uploadFailure,uploadJson } from '@/lib/upload-api-response';
export const runtime='nodejs';
export async function POST(request: Request) {
  try {
    const session=await auth();
    if(!session?.user?.id) throw new Error('unauthenticated');
    const access=await getAccess(session.user.id);
    if(!access.isPaid) throw new Error('paid_required');
    const draft=validateUploadDraft(await uploadBody(request),access);
    return uploadJson(await beginPaidUpload(draft,session.user.id,access));
  } catch(error){return uploadFailure(error);}
}
