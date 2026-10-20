// Producentlänk (ingen inloggning): kan BARA visa bokens titel och ladda upp till just den boken.
// Inga kapitellistor, inga mätvärden, ingen lyssning eller nedladdning. Filerna mastras inte, de mäts mot specen.
import { NextRequest } from "next/server";
import { adviceLines } from "@/lib/sjoberg-advice";
import { logEvent } from "@/lib/sjoberg-events";
import { createChapter, isUuid, db, fail, linkByToken, linkFolder, noStore, tusGrant, tusPathOk } from "@/lib/sjoberg-portal";

export const dynamic = "force-dynamic";
async function handle(req: NextRequest, ctx: { params: Promise<{ token: string; path?: string[] }> }) {
  const { token, path = [] } = await ctx.params;
  try {
    const l = await linkByToken(token);
    if (!l) return fail("Länken finns inte.", 404);
    if (req.method === "GET" && path.length === 0) {
      const { data: b } = await db().from("sjoberg_books").select("title, narrator").eq("id", l.book_id).maybeSingle();
      return Response.json({ title: b?.title || "", narrator: b?.narrator || "", open: l.open, expires: l.expires_at }, { headers: noStore });
    }
    // Resultat för en fil som laddats upp via just den här länken: bara status och vad som ska ändras.
    if (req.method === "GET" && path.length === 2 && path[0] === "status" && isUuid(path[1])) {
      const { data: c } = await db().from("sjoberg_chapters").select("status, checks, error").eq("id", path[1]).eq("link_id", l.id).maybeSingle();
      if (!c) return fail("Filen hittades inte.", 404);
      return Response.json({ status: c.status, advice: c.status === "rejected" ? adviceLines(c.checks) : [], error: c.status === "failed" ? c.error : null }, { headers: noStore });
    }
    if (req.method !== "POST" || path.length !== 1) return fail("Ogiltig förfrågan.", 404);
    if (!l.open) return fail("Länken är stängd eller har gått ut. Kontakta förlaget.", 410);
    const x = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (path[0] === "tus") return tusGrant(linkFolder(l.id), String(x.filename || "").slice(0, 1000), Number(x.size));
    if (path[0] === "klar") {
      const p = String(x.path || "");
      if (!tusPathOk(linkFolder(l.id), p)) return fail("Ogiltig uppladdning.");
      const c = await createChapter(l.book_id, "producer", p, String(x.filename || "kapitel.wav").slice(0, 255), l.id);
      void logEvent(`producent${l.label ? ": " + l.label : ""}`, "producer_upload", { book: l.book_id, chapter: c.id }, { filename: c.original_filename });
      return Response.json({ ok: true, id: c.id }, { headers: noStore });
    }
  } catch { return fail("Tjänsten svarar inte just nu. Försök igen om en stund.", 503); }
  return fail("Ogiltig förfrågan.", 404);
}
export const GET = handle;
export const POST = handle;
