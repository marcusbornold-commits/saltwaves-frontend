// Publik hälsa för testportalen: 200 om tabellerna och bearbetnings-API:t svarar.
import { db, noStore } from "@/lib/opendoors-portal";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { error } = await db().from("opendoors_episodes").select("id", { head: true, count: "exact" }).limit(1);
    const api = process.env.OPENDOORS_API_URL || "http://127.0.0.1:8795";
    const r = await fetch(`${api}/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (error || !r.ok) throw new Error("down");
    return Response.json({ ok: true }, { headers: noStore });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: noStore });
  }
}
