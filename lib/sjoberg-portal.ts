// Sjöberg-portalen v1: böcker, kapitel och producentlänkar i Supabase (sjoberg_*), filer i audiobook-private/sjoberg-portal/.
// Körs bara på servern med service role. Mastring och mätning görs av studio-backenden (låst kedja, spec Audiobook Nordic).
// Inga interna spec-id, kedjeparametrar eller backend-texter skickas vidare till webbläsaren.
import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { logEvent, notifyChapter } from "@/lib/sjoberg-events";

export const BUCKET = "audiobook-private";
export const TENANT = "sjoberg";
export const RETENTION_DAYS = 30;
export const MAX_BYTES = 1000 * 1024 * 1024;
export const EXTS = new Set(["wav", "mp3", "m4a", "aif", "aiff", "flac"]);
export const noStore = { "Cache-Control": "private, no-store" };
export const SJ_FOLDER = "sjoberg-portal"; // tus-mapp för Sjöbergs egna uppladdningar (studio/<mapp>/<uuid>.<ext>)
export const linkFolder = (linkId: string) => `sjl-${linkId.replace(/-/g, "").slice(0, 20)}`; // en tus-mapp per producentlänk
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const isUuid = (s: string) => new RegExp(`^${UUID}$`).test(s);
export const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: noStore });

const env = () => {
  const url = process.env.AUDIOBOOK_STORAGE_URL, key = process.env.AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("storage not configured");
  return { url, key };
};
export function db() { const { url, key } = env(); return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }

const api = () => process.env.AUDIOBOOK_STUDIO_API_URL || "http://127.0.0.1:8791";
function bh(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (process.env.AUDIOBOOK_STUDIO_CF_ACCESS_CLIENT_ID && process.env.AUDIOBOOK_STUDIO_CF_ACCESS_CLIENT_SECRET) {
    h["CF-Access-Client-Id"] = process.env.AUDIOBOOK_STUDIO_CF_ACCESS_CLIENT_ID;
    h["CF-Access-Client-Secret"] = process.env.AUDIOBOOK_STUDIO_CF_ACCESS_CLIENT_SECRET;
  }
  return h;
}
const backend = (path: string, init?: RequestInit, ms = 600000) => fetch(`${api()}/${path}`, { ...init, headers: bh(), cache: "no-store", signal: AbortSignal.timeout(ms) });

// ---------- tus-grant (signerad uppladdning direkt från webbläsaren till Storage) ----------
export async function tusGrant(folder: string, filename: string, size: number) {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  if (!EXTS.has(ext)) return fail("Filtypen stöds inte. Använd WAV, MP3, M4A, AIFF eller FLAC.", 415);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) return fail("Filen får vara högst 1000 MB.", 413);
  const { url } = env();
  const path = `studio/${folder}/${randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail("Kunde inte förbereda uppladdningen.", 502);
  const endpoint = new URL(url); endpoint.hostname = endpoint.hostname.replace(".supabase.co", ".storage.supabase.co");
  return Response.json({ bucket: BUCKET, path, token: data.token, endpoint: endpoint.origin + "/storage/v1/upload/resumable/sign" }, { headers: noStore });
}
export const tusPathOk = (folder: string, path: string) => new RegExp(`^studio/${folder}/${UUID}\\.(wav|mp3|m4a|aif|aiff|flac)$`).test(path);

// ---------- kapitelnummer och namn från filnamnet ----------
export function parseChapter(filename: string, next: number) {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const kap = stem.match(/(?:kap(?:itel)?|chapter|ch)[\s._#-]*(\d{1,4})/i);
  const nums = [...stem.matchAll(/\d{1,4}/g)];
  const hit = kap ? { n: Number(kap[1]), at: kap.index!, len: kap[0].length } : nums.length ? { n: Number(nums[nums.length - 1][0]), at: nums[nums.length - 1].index!, len: nums[nums.length - 1][0].length } : null;
  const number = hit ? hit.n : next;
  let name = hit ? (stem.slice(0, hit.at) + " " + stem.slice(hit.at + hit.len)) : stem;
  name = name.replace(/[_#]+/g, " ").replace(/\s*[-–.]\s*$/g, "").replace(/^\s*[-–.]\s*/g, "").replace(/\s+/g, " ").trim();
  return { number, name: (name || `Kapitel ${number}`).slice(0, 200) };
}

// ---------- spec-punkter (egen text, aldrig backendens) ----------
export type Check = { id: "loudness" | "peak" | "noise" | "format"; label: string; value: number | string | null; unit: string; requirement: string; pass: boolean };
const LABELS: Record<Check["id"], [string, string, string]> = {
  loudness: ["Ljudnivå", "LUFS", "−17,5 LUFS ±0,5"],
  peak: ["True peak", "dBTP", "≤ −3,0 dBTP"],
  noise: ["Brusgolv (pauser)", "dBFS", "≤ −80 dBFS"],
  format: ["Format", "", "44,1 kHz / 16 bit / mono"],
};
type RawCheck = { id: string; label?: string; value?: unknown; pass?: boolean };
type RawMeasure = { checks?: RawCheck[]; sample_rate?: number; channels?: number; subtype?: string };
export function specChecks(m: RawMeasure | undefined): Check[] | null {
  if (!m?.checks) return null;
  const out: Check[] = [];
  for (const id of ["loudness", "peak", "noise", "format"] as const) {
    const c = m.checks.find(x => x.id === id && !/p90|korta|långa/i.test(String(x.label || "")));
    if (!c) continue;
    let value: number | string | null = typeof c.value === "number" ? Math.round(c.value * 10) / 10 : null;
    if (id === "format") {
      const rate = m.sample_rate, ch = m.channels, sub = String(m.subtype || "");
      const bits = /PCM_(\d+)/.exec(sub)?.[1] || (/FLOAT/.test(sub) ? "32 float" : "");
      value = rate ? `${(rate / 1000).toLocaleString("sv-SE")} kHz / ${bits ? bits + " bit" : sub || "?"} / ${ch === 1 ? "mono" : ch === 2 ? "stereo" : `${ch} kanaler`}` : null; // backendens egen formattext skickas aldrig vidare
    }
    out.push({ id, label: LABELS[id][0], value, unit: LABELS[id][1], requirement: LABELS[id][2], pass: !!c.pass });
  }
  return out;
}

// ---------- tokens för producentlänkar ----------
export const newToken = () => randomBytes(24).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export async function linkByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const { data } = await db().from("sjoberg_upload_links").select("id, book_id, label, expires_at, closed_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!data) return null;
  const open = !data.closed_at && new Date(data.expires_at).getTime() > Date.now();
  return { ...data, open };
}

// ---------- bearbetning ----------
type Chapter = { id: string; book_id: string; number: number; name: string; source: "sjoberg" | "producer"; status: string; backend_upload: string | null; backend_job: string | null; storage_path: string | null; original_filename: string; created_at: string; updated_at: string };
const inflight = new Set<string>();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function setCh(id: string, patch: Record<string, unknown>) { await db().from("sjoberg_chapters").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id); }
const finalPath = (c: Pick<Chapter, "book_id" | "id">, ext: string) => `${SJ_FOLDER}/${c.book_id}/${c.id}.${ext}`;

export async function createChapter(bookId: string, source: Chapter["source"], tusPath: string, filename: string, linkId: string | null) {
  const sb = db();
  const { data: rows } = await sb.from("sjoberg_chapters").select("number").eq("book_id", bookId).order("number", { ascending: false }).limit(1);
  const { number, name } = parseChapter(filename, (rows?.[0]?.number ?? 0) + 1);
  const { data, error } = await sb.from("sjoberg_chapters").insert({ book_id: bookId, number, name, original_filename: filename.slice(0, 255), source, link_id: linkId, status: "processing" }).select("*").single();
  if (error || !data) throw new Error("insert");
  void run(data as Chapter, tusPath);
  return data as Chapter;
}

// Mastringssidan: hela kapitlet är redan inläst (och ev. mastrat) i backend. Samma väg som portalens kapitel
// (finishMaster → samma lagringsväg, mätning och godkänt/underkänt), utan ny uppladdning av filen.
export async function archiveMaster(bookId: string, upload: string, job: string, filename: string, number: number, name: string, duration: number | null) {
  const r = await backend(`jobs/${job}`, undefined, 30000);
  const d = r.ok ? await r.json() : null;
  if (!d || d.upload !== upload || d.state === "failed") throw Object.assign(new Error("job"), { user: "Mastringen hittades inte. Mastra kapitlet igen." });
  const { data, error } = await db().from("sjoberg_chapters").insert({ book_id: bookId, number, name: name.slice(0, 200), original_filename: filename.slice(0, 255), source: "sjoberg", link_id: null, status: "processing", backend_upload: upload, backend_job: job, duration_s: duration }).select("*").single();
  if (error || !data) throw new Error("insert");
  const c = data as Chapter; inflight.add(c.id);
  void finishMaster(c).catch(async e => setCh(c.id, { status: "failed", error: (e as { user?: string }).user || "Mastern kunde inte sparas. Mastra kapitlet igen." })).finally(() => inflight.delete(c.id));
  return c;
}

async function ingest(tusPath: string, filename: string): Promise<{ id: string; duration: number }> {
  const r = await backend("ingest", { method: "POST", body: JSON.stringify({ path: tusPath, filename: filename.slice(0, 200) }) });
  if (!r.ok) throw Object.assign(new Error("ingest"), { user: r.status === 413 ? "Filen är större än 1000 MB." : r.status === 400 ? "Filen kunde inte läsas som ljud." : "Filen kunde inte läsas in." });
  return r.json();
}

async function run(c: Chapter, tusPath: string) {
  inflight.add(c.id);
  try {
    if (c.source === "producer") {
      // Producentens fil är redan mastrad: spara en kopia, mät den mot specen, mastra inte.
      const ext = tusPath.split(".").pop()!;
      const keep = finalPath(c, ext);
      const { error } = await db().storage.from(BUCKET).copy(tusPath, keep);
      if (error) throw Object.assign(new Error("copy"), { user: "Filen hittades inte i lagringen." });
      const up = await ingest(tusPath, c.original_filename);
      await setCh(c.id, { backend_upload: up.id, duration_s: up.duration });
      const r = await backend(`${up.id}/measure`, { method: "POST" });
      if (!r.ok) throw Object.assign(new Error("measure"), { user: "Filen kunde inte mätas." });
      const checks = specChecks(await r.json());
      const pass = !!checks && checks.length === 4 && checks.every(x => x.pass);
      if (!pass) await db().storage.from(BUCKET).remove([keep]); // bara godkända filer sparas
      await setCh(c.id, { status: pass ? "approved" : "rejected", checks, storage_path: pass ? keep : null, error: null });
      if (pass) void logEvent("server", "chapter_saved", { book: c.book_id, chapter: c.id }, { pass, source: "producent" });
      if (!pass) void notifyChapter(c.id, "producer_rejected", false, checks);
    } else {
      const up = await ingest(tusPath, c.original_filename);
      const r = await backend(`${up.id}/master`, { method: "POST", body: JSON.stringify({ declick: "av", klang: "neutral", mic: "condenser" }) });
      if (!r.ok) throw Object.assign(new Error("master"), { user: "Mastringen kunde inte startas." });
      const { job } = await r.json();
      await setCh(c.id, { backend_upload: up.id, backend_job: job, duration_s: up.duration });
      await finishMaster({ ...c, backend_upload: up.id, backend_job: job });
    }
  } catch (e) {
    await setCh(c.id, { status: "failed", error: (e as { user?: string }).user || "Bearbetningen kunde inte slutföras. Ladda upp filen igen." });
  } finally { inflight.delete(c.id); }
}

async function finishMaster(c: Chapter) {
  const started = Date.now();
  for (;;) {
    const r = await backend(`jobs/${c.backend_job}`, undefined, 30000).catch(() => null);
    if (r && r.status === 404) throw Object.assign(new Error("job"), { user: "Mastringen avbröts. Ladda upp filen igen." });
    const d = r && r.ok ? await r.json() : null;
    if (d?.state === "failed") throw Object.assign(new Error("job"), { user: "Mastringen kunde inte slutföras. Ladda upp filen igen." });
    if (d?.state === "done") {
      const checks = specChecks({ ...d.result, sample_rate: 44100, channels: 1, subtype: "PCM_16" });
      const fmt = checks?.find(x => x.id === "format"); if (fmt && !d.result?.checks?.find((x: RawCheck) => x.id === "format")) fmt.pass = true;
      const pass = !!checks && checks.length >= 3 && checks.every(x => x.pass);
      const path = finalPath(c, "wav");
      await uploadMaster(c.backend_upload!, path);
      await setCh(c.id, { status: pass ? "approved" : "rejected", checks, storage_path: path, error: null });
      void logEvent("server", "chapter_saved", { book: c.book_id, chapter: c.id }, { pass });
      void notifyChapter(c.id, "done", pass, checks);
      return;
    }
    if (Date.now() - started > 4 * 3600e3) throw Object.assign(new Error("timeout"), { user: "Mastringen tog för lång tid. Ladda upp filen igen." });
    await sleep(4000);
  }
}

async function uploadMaster(uid: string, path: string) {
  const { url, key } = env();
  const src = await backend(`${uid}/audio/master`, undefined, 3600e3);
  if (!src.ok || !src.body) throw Object.assign(new Error("audio"), { user: "Mastern kunde inte sparas." });
  const h: Record<string, string> = { authorization: `Bearer ${key}`, apikey: key, "content-type": "audio/wav", "x-upsert": "true" };
  const len = src.headers.get("content-length"); if (len) h["content-length"] = len;
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: h, body: src.body, duplex: "half" } as RequestInit);
  if (!r.ok) throw Object.assign(new Error("store " + r.status), { user: "Mastern kunde inte sparas." });
}

// Återuppta eller avsluta kapitel som var i arbete när servern startades om.
export async function refresh(chapters: Chapter[]) {
  for (const c of chapters) {
    if (c.status !== "processing" || inflight.has(c.id)) continue;
    if (c.source === "sjoberg" && c.backend_job && c.backend_upload) {
      inflight.add(c.id);
      void finishMaster(c).catch(async e => setCh(c.id, { status: "failed", error: (e as { user?: string }).user || "Mastringen avbröts. Ladda upp filen igen." })).finally(() => inflight.delete(c.id));
    } else if (Date.now() - new Date(c.updated_at).getTime() > 15 * 60e3) {
      await setCh(c.id, { status: "failed", error: "Bearbetningen avbröts. Ladda upp filen igen." });
    }
  }
}

// 30 dagar efter leverans (första nedladdningen) tas filerna bort.
export async function purgeExpired() {
  const sb = db();
  const { data: books } = await sb.from("sjoberg_books").select("id").eq("tenant", TENANT).lt("expires_at", new Date().toISOString());
  for (const b of books || []) {
    const { data: ch } = await sb.from("sjoberg_chapters").select("id, storage_path").eq("book_id", b.id).not("storage_path", "is", null);
    const paths = (ch || []).map(x => x.storage_path as string);
    if (paths.length) { await sb.storage.from(BUCKET).remove(paths); await sb.from("sjoberg_chapters").update({ storage_path: null }).in("id", (ch || []).map(x => x.id)); }
  }
}

export const safeName = (s: string) => s.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/[\s–—-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80) || "Bok";
export const zipName = (title: string, n: number, name: string) => `${safeName(title)}_${String(n).padStart(2, "0")}_${safeName(name)}.wav`;

export function reportCsv(book: { title: string; narrator: string; isbn: string | null }, chapters: Array<{ number: number; name: string; source: string; status: string; checks: Check[] | null; duration_s: number | null }>) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const st: Record<string, string> = { approved: "Godkänd", rejected: "Underkänd", processing: "Bearbetas", uploaded: "Uppladdad", failed: "Fel" };
  const num = (c: Check[] | null, id: string) => { const x = c?.find(k => k.id === id); return x ? (typeof x.value === "number" ? x.value.toFixed(1).replace(".", ",") : String(x.value ?? "")) : ""; };
  const ok = (c: Check[] | null, id: string) => { const x = c?.find(k => k.id === id); return x ? (x.pass ? "OK" : "Avvikelse") : ""; };
  const lines = [
    [q("Mätrapport · Audiobook Nordic"), q(book.title), q(book.narrator), q(book.isbn || "")].join(";"),
    ["Kapitel", "Namn", "Fil", "Källa", "Status", "Ljudnivå (LUFS)", "Ljudnivå", "True peak (dBTP)", "True peak", "Brusgolv (dBFS)", "Brusgolv", "Format", "Format OK", "Längd (min)"].map(q).join(";"),
    ...chapters.map(c => [c.number, c.name, c.status === "approved" ? zipName(book.title, c.number, c.name) : "", c.source === "producer" ? "Producent" : "Sjöberg", st[c.status] || c.status,
      num(c.checks, "loudness"), ok(c.checks, "loudness"), num(c.checks, "peak"), ok(c.checks, "peak"), num(c.checks, "noise"), ok(c.checks, "noise"), num(c.checks, "format"), ok(c.checks, "format"),
      c.duration_s ? (c.duration_s / 60).toFixed(1).replace(".", ",") : ""].map(q).join(";")),
    "", q("Krav: ljudnivå −17,5 LUFS ±0,5 · true peak ≤ −3,0 dBTP · brusgolv i pauser (median) ≤ −80 dBFS · 44,1 kHz / 16 bit / mono"),
  ];
  return "\ufeff" + lines.join("\r\n") + "\r\n";
}
