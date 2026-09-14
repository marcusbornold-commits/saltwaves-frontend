import "server-only";
import { auth } from "@/auth";
export async function audiobookAccess() {
  const session = await auth();
  const allowed = new Set((process.env.AUDIOBOOK_ALLOWED_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean));
  return { session, allowed: process.env.AUDIOBOOK_ENABLED === "true" && !!session?.user?.id && !!session.user.email && allowed.has(session.user.email.toLowerCase()) };
}
