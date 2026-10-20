// Sjöberg-sidans API: bara de anrop sidan behöver, och svaren rensas till det sidan visar.
// Specen heter "Audiobook Nordic" utåt; interna spec-id, kedjeparametrar och filvägar skickas aldrig till webbläsaren.
import { NextRequest } from "next/server";
import { POST as tusGrant } from "../../audiobook-studio/tus/route";

export const dynamic = "force-dynamic";
const base = () => process.env.AUDIOBOOK_STUDIO_API_URL || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8791");
const MIC = "condenser"; // fast tills vidare (Marcus 2026-10-20)
const ID = /^[a-f0-9]{32}$/;
const noStore = { "Cache-Control": "private, no-store" };
type Check = { id: string; label: string; value: unknown; unit?: string; requirement: string; pass: boolean; required?: boolean };
const KEEP = new Set(["loudness", "peak", "noise", "format"]);
const scrub = (s: string) => s.replace(/storytel/gi, "Audiobook Nordic");
const fail = (error: string, status = 502) => Response.json({ error }, { status, headers: noStore });

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (process.env.AUDIOBOOK_STUDIO_CF_ACCESS_CLIENT_ID && process.env.AUDIOBOOK_STUDIO_CF_ACCESS_CLIENT_SECRET) {
    h["CF-Access-Client-Id"] = process.env.AUDIOBOOK_STUDIO_CF_ACCESS_CLIENT_ID;
    h["CF-Access-Client-Secret"] = process.env.AUDIOBOOK_STUDIO_CF_ACCESS_CLIENT_SECRET;
  }
  return h;
}
function measureOut(m: { checks?: Check[]; pass?: boolean } | undefined) {
  if (!m?.checks) return null;
  const checks = m.checks.filter(c => KEEP.has(c.id) && !/p90|korta|långa/i.test(c.label))
    .map(c => ({ id: c.id, label: scrub(c.label), value: typeof c.value === "string" ? scrub(c.value) : c.value, unit: c.unit, requirement: scrub(c.requirement), pass: !!c.pass }));
  return { pass: checks.every(c => c.pass), checks };
}
async function call(path: string, init?: RequestInit) {
  const api = base(); if (!api) throw new Error("no api");
  return fetch(`${api}/${path}`, { ...init, headers: headers(), cache: "no-store", signal: AbortSignal.timeout(180000) });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const p = (await ctx.params).path;
  try {
    if (req.method === "POST" && p.length === 1 && p[0] === "tus") return tusGrant(req);
    if (req.method === "POST" && p.length === 1 && p[0] === "ingest") {
      const body = await req.json().catch(() => ({}));
      const r = await call("ingest", { method: "POST", body: JSON.stringify({ path: String(body.path || ""), filename: String(body.filename || "audio.wav").slice(0, 200) }) });
      if (!r.ok) return fail(r.status === 413 ? "Filen är större än 1000 MB." : "Filen kunde inte läsas in. Försök igen.", r.status === 413 ? 413 : 502);
      const d = await r.json(); return Response.json({ id: d.id, duration: d.duration }, { headers: noStore });
    }
    if (p.length === 2 && ID.test(p[0]) && req.method === "POST" && p[1] === "measure") {
      const r = await call(`${p[0]}/measure`, { method: "POST" });
      if (!r.ok) return fail("Originalet kunde inte mätas.");
      return Response.json(measureOut(await r.json()), { headers: noStore });
    }
    if (p.length === 2 && ID.test(p[0]) && req.method === "POST" && p[1] === "master") {
      const r = await call(`${p[0]}/master`, { method: "POST", body: JSON.stringify({ declick: "av", klang: "neutral", mic: MIC }) });
      if (!r.ok) return fail("Mastringen kunde inte startas. Försök igen.");
      const d = await r.json(); return Response.json({ job: d.job }, { headers: noStore });
    }
    if (p.length === 2 && p[0] === "jobs" && ID.test(p[1]) && req.method === "GET") {
      const r = await call(`jobs/${p[1]}`);
      if (!r.ok) return fail("Körningen kunde inte hittas.", 404);
      const d = await r.json();
      if (d.state === "done") return Response.json({ state: "done", result: measureOut(d.result) }, { headers: noStore });
      if (d.state === "failed") return Response.json({ state: "failed", error: "Mastringen kunde inte slutföras. Försök igen eller kontakta Saltwaves." }, { headers: noStore });
      return Response.json({ state: "running" }, { headers: noStore });
    }
    if (p.length === 3 && ID.test(p[0]) && p[1] === "audio" && p[2] === "master" && req.method === "GET") {
      const r = await call(`${p[0]}/audio/master`);
      if (!r.ok || !r.body) return fail("Filen är inte klar.", 404);
      const out = new Headers({ "content-type": "audio/wav", "cache-control": "private, no-store" });
      const len = r.headers.get("content-length"); if (len) out.set("content-length", len);
      return new Response(r.body, { status: 200, headers: out });
    }
  } catch { return fail("Tjänsten svarar inte just nu. Försök igen om en stund.", 503); }
  return fail("Ogiltig förfrågan.", 404);
}
export const GET = handle;
export const POST = handle;
