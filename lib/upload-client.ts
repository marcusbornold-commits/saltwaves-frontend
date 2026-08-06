import {
  accessForTokenTier,
  durationError,
  exceedsDuration,
  exceedsFileSize,
  fileSizeError,
  FREE_ACCESS,
  morePermissive,
  type AccessLevel,
} from "@/lib/access-limits";
import { decodeJwt } from "jose";

/**
 * Reads the tier out of the upload token without verifying it. Safe: the tier
 * only picks which limits the browser pre-checks against and which plan the
 * error copy names. /api/upload-token signed it and the backend verifies it —
 * nothing here is an authorisation decision.
 */
function accessFromToken(token: string): AccessLevel | null {
  try {
    const tier = decodeJwt(token).tier;
    return tier === "lifetime_creator" || tier === "free"
      ? accessForTokenTier(tier)
      : null;
  } catch {
    return null;
  }
}

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
  // Same table the API route enforces against — see lib/access-limits.ts.
  access: AccessLevel = FREE_ACCESS,
  durationSeconds: number | null = null,
  onProgress?: (loaded: number, total: number) => void,
): Promise<UploadResult> {
  if (!/\.(wav|mp3|m4a)$/i.test(file.name)) {
    throw new UploadError(
      "This doesn't look like an audio file we can read. We support WAV, MP3, and M4A.",
      "invalid_file_type",
    );
  }

  // Ahead of the limit checks, so a signed-in caller is measured against their
  // own tier. A 401 (or any other failure) means anonymous — same upload as
  // before, same free limits.
  let token: string | null = null;
  try {
    const tokenRes = await fetch("/api/upload-token");
    if (tokenRes.ok) {
      const tokenData = (await tokenRes.json()) as { token?: string | null };
      token = tokenData.token ?? null;
    }
  } catch {
    token = null;
  }

  // The token's tier is coarse (founding or not), so it raises the ceiling the
  // page was rendered with, never lowers it — a Studio subscriber must not be
  // cut down to free limits just because they aren't a founding member.
  const tokenAccess = token ? accessFromToken(token) : null;
  const effectiveAccess = tokenAccess
    ? morePermissive(access, tokenAccess)
    : access;

  if (exceedsFileSize(effectiveAccess, file.size)) {
    throw new UploadError(
      fileSizeError(effectiveAccess, file.size),
      "file_too_large",
    );
  }

  if (
    durationSeconds !== null &&
    exceedsDuration(effectiveAccess, durationSeconds)
  ) {
    throw new UploadError(
      durationError(effectiveAccess, durationSeconds),
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

  const params = new URLSearchParams({ mode: "standard", mic_type: micType });
  if (email) params.set("email", email);

  const form = new FormData();
  form.append("file", file, file.name);

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBase}/upload?${params.toString()}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

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
        /* empty body or non-JSON */
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

    xhr.onerror = (event) => {
      console.error("Upload network error", {
        status: xhr.status,
        statusText: xhr.statusText,
        readyState: xhr.readyState,
        event,
      });
      reject(
        new UploadError(
          "Upload is temporarily unavailable — try again in a few minutes.",
          "service_unavailable",
        ),
      );
    };

    xhr.send(form);
  });
}
