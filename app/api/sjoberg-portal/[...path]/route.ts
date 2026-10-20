// Sjöberg-portalens API (bakom invite-skyddet i proxy.ts, scope "sjoberg"). Bara vitlistade anrop; svaren innehåller bara det portalen visar.
import { NextRequest } from "next/server";
import { BUCKET, RETENTION_DAYS, SJ_FOLDER, TENANT, archiveMaster, createChapter, parseChapter, db, fail, hashToken, isUuid, newToken, noStore, purgeExpired, refresh, reportCsv, tusGrant, tusPathOk, zipName, type Check } from "@/lib/sjoberg-portal";
import { zipStream } from "@/lib/zip-stream";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;
const CH_FIELDS = "id, number, name, original_filename, source, status, checks, duration_s, error, created_at, storage_path, link_id";
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
type Ch = { id: string; number: number; name: string; original_filename: string; source: string; status: string; checks: Check[] | null; duration_s: number | null; error: string | null; created_at: string; storage_path: string | null; link_id: string | null };
const norm = (v: unknown) => String(v ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
async function removeFolder(prefix: string) { // städar även filer som inte finns i tabellen
  const sb = db();
  for (let i = 0; i < 20; i++) {
    const { data } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
    const files = (data || []).filter(f => f.id).map(f => `${prefix}/${f.name}`);
    if (!files.length) return;
    const { error } = await sb.storage.from(BUCKET).remove(files); if (error) throw new Error("storage");
  }
}
const pub = (c: Ch) => ({ id: c.id, number: c.number, name: c.name, filename: c.original_filename, source: c.source, status: c.status, checks: c.checks, duration: c.duration_s, error: c.error, created: c.created_at, stored: !!c.storage_path });

async function book(id: string) {
  if (!isUuid(id)) return null;
  const { data } = await db().from("sjoberg_books").select("id, title, narrator, isbn, is_test, created_at, delivered_at, expires_at").eq("id", id).eq("tenant", TENANT).maybeSingle();
  return data;
}
async function chapters(bookId: string) {
  const { data } = await db().from("sjoberg_chapters").select(CH_FIELDS + ", book_id, backend_upload, backend_job, updated_at").eq("book_id", bookId).order("number").order("created_at");
  return (data || []) as unknown as (Ch & { book_id: string; backend_upload: string | null; backend_job: string | null; updated_at: string })[];
}
async function signed(path: string) {
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) throw new Error("sign");
  const r = await fetch(data.signedUrl); if (!r.ok || !r.body) throw new Error("fetch"); return r;
}
async function deliver(id: string, b: { delivered_at: string | null }) {
  if (b.delivered_at) return;
  const now = new Date(); await db().from("sjoberg_books").update({ delivered_at: now.toISOString(), expires_at: new Date(now.getTime() + RETENTION_DAYS * 86400e3).toISOString() }).eq("id", id);
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const p = (await ctx.params).path, m = req.method;
  const body = async () => (m === "POST" || m === "PATCH" || m === "DELETE") ? await req.json().catch(() => ({})) as Record<string, unknown> : {};
  try {
    const sb = db();
    if (p.length === 1 && p[0] === "books") {
      if (m === "GET") {
        await purgeExpired().catch(() => {});
        const { data } = await sb.from("sjoberg_books").select("id, title, narrator, isbn, is_test, created_at, delivered_at, expires_at, sjoberg_chapters(status)").eq("tenant", TENANT).order("created_at", { ascending: false });
        return Response.json({ books: (data || []).map(({ sjoberg_chapters: ch, ...b }) => ({ ...b, chapters: (ch as { status: string }[]).length, approved: (ch as { status: string }[]).filter(c => c.status === "approved").length, rejected: (ch as { status: string }[]).filter(c => c.status === "rejected").length })) }, { headers: noStore });
      }
      if (m === "POST") {
        const b = await body(); const title = str(b.title, 200);
        if (!title) return fail("Ange bokens titel.");
        const isbn = str(b.isbn, 32).replace(/[^0-9Xx-]/g, "") || null;
        const { data, error } = await sb.from("sjoberg_books").insert({ tenant: TENANT, title, narrator: str(b.narrator, 200), isbn, is_test: b.test === true }).select("id").single();
        if (error || !data) return fail("Boken kunde inte skapas.", 502);
        return Response.json({ id: data.id }, { headers: noStore });
      }
    }
    if (p[0] === "books" && p.length >= 2) {
      const b = await book(p[1]); if (!b) return fail("Boken hittades inte.", 404);
      if (p.length === 2 && m === "GET") {
        const ch = await chapters(b.id); await refresh(ch as never).catch(() => {});
        const { data: links } = await sb.from("sjoberg_upload_links").select("id, label, expires_at, closed_at, created_at").eq("book_id", b.id).order("created_at");
        return Response.json({ book: b, chapters: ch.map(pub), links: (links || []).map(l => ({ ...l, open: !l.closed_at && new Date(l.expires_at).getTime() > Date.now() })), retentionDays: RETENTION_DAYS }, { headers: noStore });
      }
      if (p.length === 2 && m === "PATCH") {
        const x = await body(); const patch: Record<string, unknown> = {};
        if (x.title !== undefined) { const t = str(x.title, 200); if (!t) return fail("Ange bokens titel."); patch.title = t; }
        if (x.narrator !== undefined) patch.narrator = str(x.narrator, 200);
        if (x.isbn !== undefined) patch.isbn = str(x.isbn, 32).replace(/[^0-9Xx-]/g, "") || null;
        await sb.from("sjoberg_books").update(patch).eq("id", b.id); return Response.json({ ok: true }, { headers: noStore });
      }
      if (p.length === 2 && m === "DELETE") {
        const x = await body();
        if (norm(x.confirm) !== norm(b.title)) return fail("Skriv bokens titel exakt för att radera.", 400);
        const ch = await chapters(b.id);
        if (ch.some(c => c.status === "processing")) return fail("Vänta tills alla kapitel är klara.", 409);
        const paths = ch.map(c => c.storage_path).filter(Boolean) as string[];
        if (paths.length) { const { error } = await sb.storage.from(BUCKET).remove(paths); if (error) throw new Error("storage"); }
        await removeFolder(`${SJ_FOLDER}/${b.id}`);
        const e1 = (await sb.from("sjoberg_chapters").delete().eq("book_id", b.id)).error;
        const e2 = (await sb.from("sjoberg_upload_links").delete().eq("book_id", b.id)).error;
        const e3 = (await sb.from("sjoberg_books").delete().eq("id", b.id).eq("tenant", TENANT)).error;
        if (e1 || e2 || e3) throw new Error("db");
        return Response.json({ ok: true }, { headers: noStore });
      }
      if (p.length === 3 && p[2] === "tus" && m === "POST") { const x = await body(); return tusGrant(SJ_FOLDER, str(x.filename, 255), Number(x.size)); }
      if (p.length === 3 && p[2] === "chapters" && m === "POST") {
        const x = await body(); const path = str(x.path, 200);
        if (!tusPathOk(SJ_FOLDER, path)) return fail("Ogiltig uppladdning.");
        const c = await createChapter(b.id, "sjoberg", path, str(x.filename, 255) || "kapitel.wav", null);
        return Response.json({ id: c.id, number: c.number, name: c.name }, { headers: noStore });
      }
      if (p.length === 3 && p[2] === "archive" && m === "POST") {
        const x = await body(); const up = str(x.upload, 32), job = str(x.job, 32), hex = /^[a-f0-9]{32}$/;
        if (!hex.test(up) || !hex.test(job)) return fail("Ogiltig mastring.");
        const filename = str(x.filename, 255) || "kapitel.wav";
        const { data: rows } = await sb.from("sjoberg_chapters").select("number").eq("book_id", b.id).order("number", { ascending: false }).limit(1);
        const guess = parseChapter(filename, (rows?.[0]?.number ?? 0) + 1);
        const n = x.number === undefined || x.number === "" ? guess.number : Math.round(Number(x.number));
        if (!(n >= 0 && n <= 9999)) return fail("Ogiltigt kapitelnummer.");
        const name = str(x.name, 200) || guess.name;
        const dur = Number(x.duration); 
        try { const c = await archiveMaster(b.id, up, job, filename, n, name, Number.isFinite(dur) && dur > 0 ? dur : null); return Response.json({ id: c.id, number: c.number, name: c.name }, { headers: noStore }); }
        catch (e) { const u = (e as { user?: string }).user; if (u) return fail(u, 409); throw e; }
      }
      if (p.length === 3 && p[2] === "links" && m === "POST") {
        const x = await body(); const days = Math.min(90, Math.max(1, Math.round(Number(x.days) || 14)));
        const token = newToken();
        const { error } = await sb.from("sjoberg_upload_links").insert({ book_id: b.id, token_hash: hashToken(token), label: str(x.label, 120), expires_at: new Date(Date.now() + days * 86400e3).toISOString() });
        if (error) return fail("Länken kunde inte skapas.", 502);
        return Response.json({ path: `/tools/audiobook/sjoberg/lamna/${token}` }, { headers: noStore });
      }
      if (p.length === 3 && (p[2] === "zip" || p[2] === "rapport.csv") && m === "GET") {
        const ch = await chapters(b.id);
        const csv = new TextEncoder().encode(reportCsv(b, ch));
        const base = zipName(b.title, 0, "x").replace(/_00_x\.wav$/, "");
        if (p[2] === "rapport.csv") return new Response(csv, { headers: { ...noStore, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(base + "_matrapport.csv")}` } });
        const ok = ch.filter(c => c.status === "approved" && c.storage_path);
        if (!ok.length) return fail("Det finns inga godkända kapitel att ladda ner ännu.", 409);
        await deliver(b.id, b);
        const used = new Set<string>();
        const entries = ok.map(c => { let n = zipName(b.title, c.number, c.name); for (let i = 2; used.has(n); i++) n = zipName(b.title, c.number, `${c.name}-${i}`); used.add(n); return { name: n, open: async () => { const r = await signed(c.storage_path!); return { body: r.body!, size: Number(r.headers.get("content-length")) || null }; } }; });
        entries.push({ name: `${base}_matrapport.csv`, open: async () => csv as never });
        return new Response(zipStream(entries), { headers: { ...noStore, "content-type": "application/zip", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(base + ".zip")}` } });
      }
    }
    if (p[0] === "chapters" && p.length >= 2 && isUuid(p[1])) {
      const { data: c } = await sb.from("sjoberg_chapters").select("id, book_id, number, name, storage_path, status").eq("id", p[1]).maybeSingle();
      if (!c || !(await book(c.book_id))) return fail("Kapitlet hittades inte.", 404);
      if (p.length === 2 && m === "PATCH") {
        const x = await body(); const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (x.name !== undefined) { const n = str(x.name, 200); if (!n) return fail("Ange ett kapitelnamn."); patch.name = n; }
        if (x.number !== undefined) { const n = Math.round(Number(x.number)); if (!(n >= 0 && n <= 9999)) return fail("Ogiltigt kapitelnummer."); patch.number = n; }
        await sb.from("sjoberg_chapters").update(patch).eq("id", c.id); return Response.json({ ok: true }, { headers: noStore });
      }
      if (p.length === 2 && m === "DELETE") {
        const x = await body(); const typed = norm(x.confirm);
        if (!typed || (typed !== norm(c.name) && typed !== String(c.number))) return fail("Skriv kapitlets namn eller nummer exakt för att radera.", 400);
        if (c.status === "processing") return fail("Vänta tills kapitlet är klart.", 409);
        const { data: objs } = await sb.storage.from(BUCKET).list(`${SJ_FOLDER}/${c.book_id}`, { limit: 100, search: c.id });
        const paths = new Set((objs || []).filter(o => o.name.startsWith(c.id + ".")).map(o => `${SJ_FOLDER}/${c.book_id}/${o.name}`));
        if (c.storage_path) paths.add(c.storage_path);
        if (paths.size) { const { error } = await sb.storage.from(BUCKET).remove([...paths]); if (error) throw new Error("storage"); }
        await sb.from("sjoberg_chapters").delete().eq("id", c.id); return Response.json({ ok: true }, { headers: noStore });
      }
      if (p.length === 3 && p[2] === "audio" && m === "GET" && c.storage_path) {
        const r = await signed(c.storage_path); const h = new Headers({ ...noStore, "content-type": "audio/wav" }); const len = r.headers.get("content-length"); if (len) h.set("content-length", len);
        return new Response(r.body, { headers: h });
      }
    }
    if (p[0] === "links" && p.length === 3 && isUuid(p[1]) && p[2] === "close" && m === "POST") {
      const { data: l } = await sb.from("sjoberg_upload_links").select("id, book_id").eq("id", p[1]).maybeSingle();
      if (!l || !(await book(l.book_id))) return fail("Länken hittades inte.", 404);
      await sb.from("sjoberg_upload_links").update({ closed_at: new Date().toISOString() }).eq("id", l.id).is("closed_at", null);
      return Response.json({ ok: true }, { headers: noStore });
    }
  } catch { return fail("Tjänsten svarar inte just nu. Försök igen om en stund.", 503); }
  return fail("Ogiltig förfrågan.", 404);
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
