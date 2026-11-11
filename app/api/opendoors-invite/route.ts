import { NextRequest, NextResponse } from "next/server";
import { OPENDOORS_COOKIE, verifyOpendoorsInvite } from "@/lib/opendoors-invite";
import { logEvent } from "@/lib/opendoors-events";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  let token = "";
  try { token = String((await req.json()).token || ""); } catch { /* */ }
  const inv = verifyOpendoorsInvite(token);
  if (!inv) return NextResponse.json({ error: "Länken är ogiltig eller återkallad." }, { status: 401 });
  await logEvent(inv.name, "login");
  const res = NextResponse.json({ ok: true, name: inv.name });
  res.cookies.set(OPENDOORS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.OPENDOORS_COOKIE_INSECURE === "0",
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 3600,
  });
  return res;
}
