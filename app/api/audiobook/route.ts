import { remoteAccess, remoteError, signedAudio, privateHeaders } from "@/lib/audiobook-remote";
import { masterFilename } from "@/lib/audiobook-filename";
import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const base = "http://127.0.0.1:8766";
// Local preview guard. The customer adapter must use a durable queue instead.
let accepting = false;
let activeJobId: string | null = null;
const headers = { "Cache-Control": "no-store" };
function failure(message: string, status = 503) { return Response.json({ error: message }, { status, headers }); }
function permitted(req: NextRequest) {
  // Preview only. Customer access requires the authenticated Mac Mini adapter.
  if (process.env.NODE_ENV === "production") return false;
  const url = new URL(req.url);
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    && (!req.headers.get("origin") || req.headers.get("origin") === url.origin);
}
export async function POST(req: NextRequest) {
  if (!permitted(req)) return failure("Sidan är inte tillgänglig.", 403);
  const target = Number(req.nextUrl.searchParams.get("target"));
  if (![-19, -18, -17, -16].includes(target)) return failure("Välj en giltig LUFS-nivå.", 400);
  const filename = req.nextUrl.searchParams.get("filename") || "audio.wav";
  if (!/\.(wav|mp3|m4a|aiff)$/i.test(filename)) return failure("Välj WAV, MP3, M4A eller AIFF.", 400);
  const length = Number(req.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > 200 * 1024 * 1024) return failure("Filen får vara högst 200 MB.", 413);
  if (accepting) return failure("En mastring startas redan. Försök igen om en stund.", 409);
  accepting = true;
  try {
    if (activeJobId) {
      const status = await fetch(`${base}/job/${activeJobId}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!status.ok && status.status !== 404) return failure("Status kunde inte kontrolleras. Försök igen om en stund.");
      if (status.ok && (await status.json()).status === "running") return failure("En annan fil mastras just nu. Försök igen när den är klar.", 409);
      activeJobId = null;
    }
    const body = await req.arrayBuffer();
    if (body.byteLength > 200 * 1024 * 1024) return failure("Filen är för stor.", 413);
    const params = new URLSearchParams({ spec: `audiobook_${Math.abs(target)}`, filename, mode: "standard", mic: "unknown" });
    const result = await fetch(`${base}/run?${params}`, { method: "POST", body, signal: AbortSignal.timeout(120000) });
    if (!result.ok) return failure("Mastringen kunde inte startas. Försök igen om en stund.");
    const data = await result.json();
    activeJobId = data.id;
    return Response.json(data, { headers });
  } catch { return failure("Mastringen är tillfälligt otillgänglig. Din fil finns kvar här."); }
  finally { accepting = false; }
}
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.AUDIOBOOK_REMOTE_DEV === "true") {
    try {
      const remote = await remoteAccess();
      const id = req.nextUrl.searchParams.get("id") || "";
      const kind = req.nextUrl.searchParams.get("kind") || "status";
      if (!/^[a-f0-9]{32}$/.test(id)) return failure("Körningen kunde inte hittas.",404);
      const data = await remote(`/jobs/${id}`);
      if (data.status === "done" && !data.media) return Response.json({status:"error",error:"Den här körningen skapades före molnuppdateringen. Välj filen igen för att skapa en ny jämförelse."},{headers:privateHeaders});
      if (kind === "download") {
        if (data.status !== "done" || !data.media?.download) return failure("Filen är inte klar.",409);
        const requested = req.nextUrl.searchParams.get("filename");
        const filename = requested ? masterFilename(requested) : (data.mode === "preview" ? "audiobook-provmaster.wav" : "audiobook-master.wav");
        if (!filename) return failure("Ange ett giltigt filnamn för WAV-filen.",400);
        return Response.json({url:await signedAudio(data.media.download,id,filename,data.expires)},{headers:privateHeaders});
      }
      if (kind !== "status") return failure("Ogiltig förfrågan.",400);
      if (data.sourcePath && data.sourceId) {
        data.sourceUrl = await signedAudio(data.sourcePath,data.sourceId,undefined,data.expires);
      }
      delete data.sourcePath;
      if (data.media) {
        for (const slot of ["before","after"]) if (data.media[slot]?.path) {
          data.media[slot].url = await signedAudio(data.media[slot].path,id,undefined,data.expires);
          delete data.media[slot].path;
        }
        delete data.media.download;
      }
      return Response.json(data,{headers:privateHeaders});
    } catch (error) { return remoteError(error); }
  }

  if (!permitted(req)) return failure("Sidan är inte tillgänglig.", 403);
  const id = req.nextUrl.searchParams.get("id") || "";
  const kind = req.nextUrl.searchParams.get("kind") || "status";
  if (!/^[a-f0-9]{12}$/.test(id) || !["status", "before", "after", "download"].includes(kind)) return failure("Ogiltig förfrågan.", 400);
  const path = kind === "status" ? `/job/${id}` : kind === "download" ? `/download/${id}` : `/audio/${id}/${kind}`;
  try {
    const result = await fetch(base + path, { cache: "no-store", signal: AbortSignal.timeout(120000) });
    if (!result.ok) return failure(result.status === 404 ? "Körningen kunde inte hittas. Ladda upp filen igen." : "Resultatet kan inte hämtas just nu.", result.status === 404 ? 404 : 503);
    if (kind === "status") {
      const data = await result.json();
      const matches = [...String(data.log || "").matchAll(/\[FINAL QC\] target=([-\d.]+) measured=([-\d.]+) true_peak=([-\d.]+)/g)];
      const last = matches.at(-1);
      return Response.json({ status: data.status, result: last ? { target: Number(last[1]), lufs: Number(last[2]), peak: Number(last[3]) } : null,
        error: data.status === "error" ? "Filen kunde inte färdigställas eller klara slutkontrollen. Prova en annan fil eller kontakta oss." : null }, { headers });
    }
    const out = new Headers(headers);
    out.set("Content-Type", result.headers.get("content-type") || "audio/wav");
    const disposition = result.headers.get("content-disposition");
    if (disposition) out.set("Content-Disposition", disposition);
    return new Response(result.body, { headers: out });
  } catch { return failure("Anslutningen är tillfälligt bruten. Vi försöker hämta status igen."); }
}
