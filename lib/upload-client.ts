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
  email = "",
): Promise<UploadResult> {
  if (!/\.(wav|mp3|m4a)$/i.test(file.name)) {
    throw new UploadError(
      "This doesn't look like an audio file we can read. We support WAV, MP3, and M4A.",
      "invalid_file_type",
    );
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!apiBase) {
    throw new UploadError(
      "Upload is temporarily unavailable — try again in a few minutes.",
      "service_unavailable",
    );
  }

  let token: string | null = null;
  try {
    const tokenRes = await fetch("/api/upload-token");
    if (tokenRes.ok) {
      const tokenData = (await tokenRes.json()) as { token: string | null };
      token = tokenData.token ?? null;
    }
  } catch {
    token = null;
  }

  const params = new URLSearchParams({ mode: "standard", mic_type: micType });
  if (email) params.set("email", email);

  const form = new FormData();
  form.append("file", file, file.name);

  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${apiBase}/upload?${params.toString()}`, {
      method: "POST",
      headers,
      body: form,
    });
  } catch {
    throw new UploadError(
      "Upload is temporarily unavailable — try again in a few minutes.",
      "service_unavailable",
    );
  }

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
