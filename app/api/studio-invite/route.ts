import { NextRequest, NextResponse } from "next/server";
import { STUDIO_COOKIE, verifyStudioInvite } from "@/lib/studio-invite";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  let token = "";
  try { token = String((await req.json()).token || ""); } catch {}
  const inv = verifyStudioInvite(token);
  // På Sjöberg-domänen gäller bara Sjöberg-invites.
  if (inv && (req.headers.get("host") || "").split(":")[0].toLowerCase() === "sjoberg.saltwaves.studio" && inv.scope !== "sjoberg") return NextResponse.json({ error: "Länken är ogiltig eller återkallad." }, { status: 401 });
  if (!inv) return NextResponse.json({ error: "Länken är ogiltig eller återkallad." }, { status: 401 });
  const res = NextResponse.json({ ok: true, name: inv.name, scope: inv.scope });
  res.cookies.set(STUDIO_COOKIE, token, { httpOnly: true, secure: process.env.STUDIO_COOKIE_INSECURE !== "1", sameSite: "lax", path: "/", maxAge: 90 * 24 * 3600 });
  return res;
}
