import { audiobookAccess } from "@/lib/audiobook-access";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (process.env.NODE_ENV !== "production" && process.env.AUDIOBOOK_REMOTE_DEV !== "true") return Response.json({ local: true }, { headers });
  const { session, allowed } = await audiobookAccess();
  if (!session?.user?.id) return Response.json({ error: "Logga in för att fortsätta." }, { status: 401, headers });
  if (!allowed) return Response.json({ error: "Ditt konto har inte tillgång till testet ännu." }, { status: 403, headers });
  const secret = process.env.AUDIOBOOK_TOKEN_SECRET || "";
  const base = process.env.AUDIOBOOK_SERVICE_URL || "";
  if (new TextEncoder().encode(secret).length < 32 || !base.startsWith("https://")) return Response.json({ error: "Testet är inte aktiverat ännu." }, { status: 503, headers });
  return Response.json({ cloud: true }, { headers });
}
