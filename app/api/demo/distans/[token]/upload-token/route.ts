import {
  DISTANS_DEMO_ACCESS,
  distansDemoDurationError,
  distansDemoFileSizeError,
  getActiveDistansDemoLink,
} from "@/lib/distans-demo";
import { exceedsDuration, exceedsFileSize } from "@/lib/access-limits";
import { signUploadToken } from "@/lib/upload-token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

function json(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Mints a short-lived PodMaster upload JWT for an active Distans demo link.
 * Validates the opaque URL token server-side and enforces 2 GB / 1 h limits
 * before the browser talks to the Mini.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  let link;
  try {
    link = await getActiveDistansDemoLink(token);
  } catch {
    return json(
      {
        error_code: "service_unavailable",
        message:
          "We couldn't verify this demo link just now — try again in a moment.",
      },
      503,
    );
  }

  if (!link) {
    return json(
      {
        error_code: "invalid_demo_link",
        message:
          "This demo link is invalid or no longer active. Ask Saltwaves for a new link.",
      },
      404,
    );
  }

  let body: {
    email?: unknown;
    filename?: unknown;
    size?: unknown;
    duration_seconds?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(
      {
        error_code: "invalid_body",
        message: "That request didn't come through correctly — try again.",
      },
      400,
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(
      {
        error_code: "invalid_email",
        message: "Enter a valid email so we can send your mastered file.",
      },
      400,
    );
  }

  const size = typeof body.size === "number" ? body.size : Number.NaN;
  if (!Number.isFinite(size) || size < 1) {
    return json(
      {
        error_code: "invalid_size",
        message: "Choose an audio file to upload.",
      },
      400,
    );
  }

  if (exceedsFileSize(DISTANS_DEMO_ACCESS, size)) {
    return json(
      {
        error_code: "file_too_large",
        message: distansDemoFileSizeError(size),
      },
      413,
    );
  }

  const durationSeconds =
    typeof body.duration_seconds === "number" &&
    Number.isFinite(body.duration_seconds)
      ? body.duration_seconds
      : null;

  if (
    durationSeconds !== null &&
    exceedsDuration(DISTANS_DEMO_ACCESS, durationSeconds)
  ) {
    return json(
      {
        error_code: "episode_too_long",
        message: distansDemoDurationError(durationSeconds),
      },
      413,
    );
  }

  // lifetime_creator maximises Mini size headroom; this route still enforces
  // Distans demo product limits (2 GB / 1 h).
  const uploadToken = await signUploadToken({
    userId: link.id,
    email,
    tier: "lifetime_creator",
  });

  if (!uploadToken) {
    return json(
      {
        error_code: "service_unavailable",
        message:
          "Upload is temporarily unavailable — try again in a few minutes.",
      },
      503,
    );
  }

  return json({
    token: uploadToken,
    tool: "distans_demo",
    max_file_size_mb: DISTANS_DEMO_ACCESS.maxFileSizeMB,
    max_duration_minutes: DISTANS_DEMO_ACCESS.maxDurationMinutes,
  });
}
