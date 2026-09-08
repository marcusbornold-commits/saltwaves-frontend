import { authorizedJob, jobSummary, queueResponse, queueFailure } from '@/lib/cloud-queue';
export const runtime = 'nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try { return queueResponse(jobSummary(await authorizedJob(request,(await params).id))); }
  catch(error) { return queueFailure(error); }
}
