import "server-only";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { inviteCookie, readInvite } from "./audiobook-invite";
export async function audiobookAccess() {
  const session = await auth();
  const allowed = new Set((process.env.AUDIOBOOK_ALLOWED_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean));
  const guest = await readInvite((await cookies()).get(inviteCookie)?.value);
  if (guest) return { session: { user: { id: guest, email: null } }, allowed: true };
  return { session, allowed: process.env.AUDIOBOOK_ENABLED === "true" && !!session?.user?.id && !!session.user.email && allowed.has(session.user.email.toLowerCase()) };
}
