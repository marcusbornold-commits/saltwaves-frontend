import { NextRequest, NextResponse } from "next/server";
import { STUDIO_COOKIE, verifyStudioToken } from "@/lib/studio-invite";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  let token = "";
  try { token = String((await req.json()).token || ""); } catch {}
  const name = verifyStudioToken(token);
  if (!name) return NextResponse.json({ error: "Länken är ogiltig eller återkallad." }, { status: 401 });
  const res = NextResponse.json({ ok: true, name });
  res.cookies.set(STUDIO_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 90 * 24 * 3600 });
  return res;
}
