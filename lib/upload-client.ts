export type MicType = "dynamic" | "condenser" | "headset" | "unknown";

export type UploadResult = {
  job_id?: string;
  [key: string]: unknown;
};

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
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Upload failed");
  }

  return data;
}
