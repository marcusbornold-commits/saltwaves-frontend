export type MicType = "dynamic" | "condenser" | "headset" | "unknown";

export type UploadResult = {
  job_id?: string;
  [key: string]: unknown;
};

export class UploadError extends Error {
  errorCode?: string;

  constructor(message: string, errorCode?: string) {
    super(message);
    this.name = "UploadError";
    this.errorCode = errorCode;
  }
}

export async function uploadAudio(
  file: File,
  micType: MicType = "unknown",
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("mic_type", micType);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: form,
  });

  const data = (await response.json().catch(() => ({}))) as UploadResult & {
    error?: string;
    message?: string;
    error_code?: string;
  };

  if (!response.ok) {
    throw new UploadError(
      data.message ?? data.error ?? "Upload failed — try again.",
      data.error_code,
    );
  }

  return data;
}
