// Open Doors: aktivitetslogg och e-postnotis. Notisen är av tills OPENDOORS_NOTIFY_ENABLED=on|test.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { OPENDOORS_COOKIE, verifyOpendoorsInvite } from "@/lib/opendoors-invite";

export type OdAction = "login" | "upload" | "start" | "done" | "failed" | "download";
const sb = () => {
  const url = process.env.AUDIOBOOK_STORAGE_URL, key = process.env.AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("storage not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};
type CookieReq = { cookies: { get(n: string): { value: string } | undefined } };
export const whoFrom = (req: CookieReq) => verifyOpendoorsInvite(req.cookies.get(OPENDOORS_COOKIE)?.value)?.name || "okänd";

export async function logEvent(who: string, action: OdAction, episodeId?: string | null, detail?: Record<string, unknown>) {
  try { await sb().from("opendoors_events").insert({ who: who.slice(0, 120), action, episode_id: episodeId || null, detail: detail || null }); }
  catch (e) { console.error("opendoors_events", (e as Error).message); }
}

// OPENDOORS_NOTIFY_ENABLED: av (standard) = bara logg · "test" = bara till OPENDOORS_NOTIFY_TEST_TO · "on" = till OPENDOORS_NOTIFY_TO.
const SITE = process.env.OPENDOORS_PUBLIC_URL || "http://127.0.0.1:3095";
const FROM = () => process.env.OPENDOORS_NOTIFY_FROM || "Saltwaves <hello@saltwaves.studio>";
function recipients(): string[] {
  const mode = (process.env.OPENDOORS_NOTIFY_ENABLED || "").toLowerCase();
  if (mode === "test") return [process.env.OPENDOORS_NOTIFY_TEST_TO || "marcus@saltwaves.studio"];
  if (mode === "on" || mode === "true" || mode === "1") return (process.env.OPENDOORS_NOTIFY_TO || "").split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
async function send(key: string, subject: string, text: string) {
  const to = recipients(), token = process.env.AUTH_RESEND_KEY;
  if (!to.length || !token) { console.log(`[opendoors-notify] (ej skickat) ${subject}\n${text}`); return; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ from: FROM(), to, subject, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) console.error("opendoors-notify", r.status);
  } catch (e) { console.error("opendoors-notify", (e as Error).message); }
}

export function episodeDoneMail(ep: { id: string; title: string; show_name: string }) {
  const subject = `Avsnittet är klart: ${ep.show_name} – ${ep.title}`;
  const text = `Hej,\n\nAvsnittet “${ep.title}” av ${ep.show_name} är mastrat och klart att lyssna på och ladda ner.\n\nÖppna avsnittet: ${SITE}/tools/opendoors/${ep.id}\n\nFilerna finns kvar i 30 dagar.\n\nVänliga hälsningar\nSaltwaves`;
  return { subject, text };
}

export async function notifyEpisodeDone(episodeId: string) {
  try {
    const { data } = await sb().from("opendoors_episodes").select("id, title, show_name").eq("id", episodeId).maybeSingle();
    if (!data) return;
    const m = episodeDoneMail(data);
    await send(`od-done-${data.id}`, m.subject, m.text);
  } catch (e) { console.error("opendoors-notify", (e as Error).message); }
}
