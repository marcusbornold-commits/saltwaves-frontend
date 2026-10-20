// Publik hälsa för portalen (UptimeRobot): 200 om tabellerna och mastringstjänsten svarar, annars 503. Inga detaljer ut.
import { db, noStore } from "@/lib/sjoberg-portal";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { error } = await db().from("sjoberg_books").select("id", { head: true, count: "exact" }).limit(1);
    const api = process.env.AUDIOBOOK_STUDIO_API_URL || "http://127.0.0.1:8791";
    const r = await fetch(`${api}/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (error || !r.ok) throw new Error("down");
    return Response.json({ ok: true }, { headers: noStore });
  } catch { return Response.json({ ok: false }, { status: 503, headers: noStore }); }
}
