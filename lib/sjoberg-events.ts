// Sjöberg: aktivitetslogg (sjoberg_events), e-postnotiser och lagringskoll. Bara server, service role.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { STUDIO_COOKIE, verifyStudioInvite } from "@/lib/studio-invite";
import { adviceLines, type AdviceCheck } from "@/lib/sjoberg-advice";

export type SjAction = "login" | "upload" | "master_start" | "chapter_saved" | "download_zip" | "report" | "delete" | "producer_upload";
const sb = () => { const url = process.env.AUDIOBOOK_STORAGE_URL, key = process.env.AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error("storage not configured"); return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); };
export const ADMIN = () => process.env.SJOBERG_ADMIN_INVITE || "sjoberg-marcus";
type CookieReq = { cookies: { get(n: string): { value: string } | undefined } };
export const whoFrom = (req: CookieReq) => verifyStudioInvite(req.cookies.get(STUDIO_COOKIE)?.value)?.name || "okänd";
export const isAdmin = (req: CookieReq) => whoFrom(req) === ADMIN();

// Loggning får aldrig stoppa ett anrop.
export async function logEvent(who: string, action: SjAction, ids: { book?: string | null; chapter?: string | null } = {}, detail?: Record<string, unknown>) {
  try { await sb().from("sjoberg_events").insert({ who: who.slice(0, 120), action, book_id: ids.book || null, chapter_id: ids.chapter || null, detail: detail || null }); }
  catch (e) { console.error("sjoberg_events", (e as Error).message); }
}

// ---------- lagring (hela projektet), cachad 10 min ----------
export const STORAGE_WARN_BYTES = 80 * 1e9;
let cache: { at: number; bytes: number } | null = null;
export async function storageBytes(): Promise<number> {
  if (cache && Date.now() - cache.at < 600e3) return cache.bytes;
  const { data, error } = await sb().rpc("sjoberg_storage_bytes");
  if (error) throw new Error("storage usage");
  cache = { at: Date.now(), bytes: Number(data) || 0 };
  if (cache.bytes >= STORAGE_WARN_BYTES) console.warn(`sjoberg storage ${Math.round(cache.bytes / 1e9)} GB ≥ 80 GB`);
  return cache.bytes;
}

// ---------- e-post ----------
// SJOBERG_NOTIFY_ENABLED: av (standard) = bara logg · "test" = bara till SJOBERG_NOTIFY_TEST_TO (marcus@saltwaves.studio) · "on" = till SJOBERG_NOTIFY_TO.
const SITE = "https://sjoberg.saltwaves.studio";
const FROM = () => process.env.SJOBERG_NOTIFY_FROM || "Saltwaves <hello@saltwaves.studio>";
function recipients(): string[] {
  const mode = (process.env.SJOBERG_NOTIFY_ENABLED || "").toLowerCase();
  if (mode === "test") return [process.env.SJOBERG_NOTIFY_TEST_TO || "marcus@saltwaves.studio"];
  if (mode === "on" || mode === "true" || mode === "1") return (process.env.SJOBERG_NOTIFY_TO || "").split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
async function send(key: string, subject: string, text: string) {
  const to = recipients(), token = process.env.AUTH_RESEND_KEY;
  if (!to.length || !token) { console.log(`[sjoberg-notify] (ej skickat) ${subject}\n${text}`); return; }
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ from: FROM(), to, subject, text }), signal: AbortSignal.timeout(10000) });
    if (!r.ok) console.error("sjoberg-notify", r.status);
  } catch (e) { console.error("sjoberg-notify", (e as Error).message); }
}
const SIGN = "\n\nVänliga hälsningar\nSaltwaves";
export function chapterDoneMail(b: { id: string; title: string }, c: { number: number; name: string }, pass: boolean, checks: AdviceCheck[] | null) {
  const subject = `Kapitel klart: ${b.title} – kapitel ${c.number}`;
  const result = pass ? "Resultat: Godkänt enligt Audiobook Nordic." : `Resultat: Underkänt enligt Audiobook Nordic.\n${adviceLines(checks).map(l => "– " + l).join("\n")}`;
  const text = `Hej,\n\nKapitel ${c.number} – ${c.name} i ”${b.title}” är mastrat och sparat i arkivet.\n\n${result}\n\nÖppna boken: ${SITE}/tools/audiobook/sjoberg/portal/${b.id}${SIGN}`;
  return { subject, text };
}
export function producerRejectedMail(b: { id: string; title: string }, c: { number: number; name: string; filename: string }, label: string, checks: AdviceCheck[] | null) {
  const subject = `Underkänd leverans: ${b.title} – ${c.filename}`;
  const text = `Hej,\n\nFilen ${c.filename} (kapitel ${c.number}) som producenten${label ? ` ${label}` : ""} laddade upp till ”${b.title}” uppfyller inte Audiobook Nordic och har inte sparats.\n\n${adviceLines(checks).map(l => "– " + l).join("\n")}\n\nProducenten har fått samma besked på uppladdningssidan och kan ladda upp en ny fil via samma länk.\n\nÖppna boken: ${SITE}/tools/audiobook/sjoberg/portal/${b.id}${SIGN}`;
  return { subject, text };
}
export async function notifyChapter(chapterId: string, kind: "done" | "producer_rejected", pass: boolean, checks: AdviceCheck[] | null) {
  try {
    const db = sb();
    const { data: c } = await db.from("sjoberg_chapters").select("id, book_id, number, name, original_filename, link_id").eq("id", chapterId).maybeSingle();
    if (!c) return;
    const { data: b } = await db.from("sjoberg_books").select("id, title").eq("id", c.book_id).maybeSingle();
    if (!b) return;
    if (kind === "done") { const m = chapterDoneMail(b, c, pass, checks); await send(`sj-done-${c.id}`, m.subject, m.text); }
    else {
      let label = ""; if (c.link_id) { const { data: l } = await db.from("sjoberg_upload_links").select("label").eq("id", c.link_id).maybeSingle(); label = l?.label || ""; }
      const m = producerRejectedMail(b, { number: c.number, name: c.name, filename: c.original_filename }, label, checks); await send(`sj-rej-${c.id}`, m.subject, m.text);
    }
  } catch (e) { console.error("sjoberg-notify", (e as Error).message); }
}
