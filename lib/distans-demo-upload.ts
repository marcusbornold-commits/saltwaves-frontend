"use client";

import {
  DISTANS_DEMO_ACCESS,
  DISTANS_DEMO_TOOL,
  distansDemoDurationError,
  distansDemoFileSizeError,
} from "@/lib/distans-demo-limits";
import { exceedsDuration, exceedsFileSize } from "@/lib/access-limits";
import {
  UploadError,
  type MicType,
  type UploadResult,
} from "@/lib/upload-client";

/**
 * Browser upload for Distans B2B demos.
 * Always posts to Mini `/upload` (B2B keeps the legacy path — not paid Storage).
 * Attributes the job with tool=distans_demo + the opaque token.
 */
export async function uploadDistansDemoAudio(input: {
  file: File;
  token: string;
  email: string;
  micType?: MicType;
  durationSeconds?: number | null;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<UploadResult> {
  const {
    file,
    token,
    email,
    micType = "unknown",
    durationSeconds = null,
    onProgress,
    signal,
  } = input;

  if (!/\.(wav|mp3|m4a)$/i.test(file.name)) {
    throw new UploadError(
      "This doesn't look like an audio file we can read. We support WAV, MP3, and M4A.",
      "invalid_file_type",
    );
  }

  if (exceedsFileSize(DISTANS_DEMO_ACCESS, file.size)) {
    throw new UploadError(distansDemoFileSizeError(file.size), "file_too_large");
  }

  if (
    durationSeconds !== null &&
    exceedsDuration(DISTANS_DEMO_ACCESS, durationSeconds)
  ) {
    throw new UploadError(
      distansDemoDurationError(durationSeconds),
      "episode_too_long",
    );
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!apiBase) {
    throw new UploadError(
      "Upload is temporarily unavailable — try again in a few minutes.",
      "service_unavailable",
    );
  }

  const ticketRes = await fetch(
    `/api/demo/distans/${encodeURIComponent(token)}/upload-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        filename: file.name,
        size: file.size,
        duration_seconds: durationSeconds,
      }),
      signal,
      cache: "no-store",
    },
  );

  let ticketData: {
    token?: string;
    error_code?: string;
    message?: string;
  } = {};
  try {
    ticketData = (await ticketRes.json()) as typeof ticketData;
  } catch {
    /* non-JSON */
  }

  if (!ticketRes.ok || !ticketData.token) {
    throw new UploadError(
      ticketData.message ??
        "This demo link is invalid or no longer active. Ask Saltwaves for a new link.",
      ticketData.error_code ?? "invalid_demo_link",
    );
  }

  const params = new URLSearchParams({
    mode: "standard",
    mic_type: micType,
    tool: DISTANS_DEMO_TOOL,
    demo_token: token,
  });
  if (email) params.set("email", email);

  const form = new FormData();
  form.append("file", file, file.name);

  const result = await new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.onloadend = () => signal?.removeEventListener("abort", onAbort);
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"));
    xhr.open("POST", `${apiBase}/upload?${params.toString()}`);
    xhr.setRequestHeader("Authorization", `Bearer ${ticketData.token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(event.loaded, event.total);
    };

    xhr.onload = () => {
      let data: UploadResult & {
        error?: string;
        message?: string;
        error_code?: string;
      } = {};
      try {
        data = JSON.parse(xhr.responseText) as typeof data;
      } catch {
        /* empty */
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new UploadError(
            data.message ?? data.error ?? "Upload failed — try again.",
            data.error_code,
          ),
        );
        return;
      }
      resolve(data);
    };

    xhr.onerror = () => {
      reject(
        new UploadError(
          "Upload is temporarily unavailable — try again in a few minutes.",
          "service_unavailable",
        ),
      );
    };

    if (signal?.aborted) {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    xhr.send(form);
  });

  try {
    await fetch(`/api/demo/distans/${encodeURIComponent(token)}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: typeof result.job_id === "string" ? result.job_id : null,
      }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }

  return result;
}
