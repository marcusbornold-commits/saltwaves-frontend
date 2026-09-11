import { NextResponse } from 'next/server';
export const uploadJson=(data: unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export function uploadFailure(error: unknown) {
  const code=error instanceof Error ? error.message : 'service_unavailable';
  const known: Record<string,[number,string]>={
    invalid_request:[400,'Please check the filename, email and upload settings.'],
    unauthenticated:[401,'Please sign in to upload with your plan.'],
    paid_required:[403,'A paid plan is required for this upload.'],
    storage_disabled:[409,'Upload settings changed. Refresh the page and try again.'],
    file_too_large:[413,'This file exceeds your plan’s file size limit.'],
    episode_too_long:[413,'This audio exceeds your plan’s duration limit.'],
    upload_conflict:[409,'This upload belongs to a different file. Please select the file again.'],
    upload_expired:[410,'This upload expired. Remove the file and start a new upload.'],
    job_not_found:[404,'Upload not found.'],
    upload_incomplete:[409,'The file has not finished uploading. Please try again.'],
    size_mismatch:[409,'The uploaded file size did not match. Please start a new upload.'],
    uploads_in_progress:[429,'You already have three uploads in progress. Finish or cancel one first.'],
    rate_limited:[429,'Too many upload attempts. Please try again later.'],
  };
  const [status,message]=known[code] ?? [503,'Upload is temporarily unavailable. Please try again shortly.'];
  return uploadJson({error_code:known[code]?code:'service_unavailable',message},status);
}
export async function uploadBody(request: Request): Promise<unknown> {
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) throw new Error('invalid_request');
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('invalid_request');
  const body=await request.text();
  if(body.length>4096) throw new Error('invalid_request');
  try{return JSON.parse(body);}catch{throw new Error('invalid_request');}
}
