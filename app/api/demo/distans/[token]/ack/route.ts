import {
  getActiveDistansDemoLink,
  markDistansDemoFirstUpload,
} from "@/lib/distans-demo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Marks first_upload_at after a successful browser upload.
 * Idempotent: only the first successful ack stamps the row.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  let link;
  try {
    link = await getActiveDistansDemoLink(token);
  } catch {
    return NextResponse.json(
      {
        error_code: "service_unavailable",
        message: "Could not update demo link status.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  if (!link) {
    return NextResponse.json(
      {
        error_code: "invalid_demo_link",
        message: "This demo link is invalid or no longer active.",
      },
      { status: 404, headers: NO_STORE },
    );
  }

  await markDistansDemoFirstUpload(link.id);

  return NextResponse.json(
    {
      ok: true,
      first_upload_at: link.first_upload_at ?? new Date().toISOString(),
    },
    { headers: NO_STORE },
  );
}
