import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import type { AccessLevel } from "@/lib/access-limits";
import { signUploadToken, tierForAccess } from "@/lib/upload-token";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error_code: "unauthenticated",
        message: "Not signed in.",
      },
      { status: 401 },
    );
  }

  // A failed profile read must not quietly mint a "free" ticket: that would
  // silently downgrade a founding member mid-upload. Fail loudly instead.
  let access: AccessLevel;
  try {
    access = await getAccess(session.user.id);
  } catch (error) {
    console.error("Could not resolve plan for upload token:", error);
    return NextResponse.json(
      {
        error_code: "plan_unavailable",
        message: "We couldn't verify your plan just now — try again in a moment.",
      },
      { status: 503 },
    );
  }

  const token = await signUploadToken({
    userId: session.user.id,
    email: session.user.email ?? null,
    tier: tierForAccess(access),
  });

  if (!token) {
    return NextResponse.json(
      {
        error_code: "service_unavailable",
        message: "Upload is temporarily unavailable — try again in a few minutes.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ token });
}
