// Studio v1: signerad tus-uppladdning direkt från webbläsaren till audiobook-Supabase (bucket audiobook-private,
// bara prefixet studio/<invite-namn>/). Ljudet går aldrig genom Cloudflare-tunneln (100 MB-gränsen).
// Bakom invite-skyddet i proxy.ts. Service role-nyckeln finns bara i serverns miljö (ops/start-studio.sh).
import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { STUDIO_COOKIE, verifyStudioToken } from "@/lib/studio-invite";

export const dynamic = "force-dynamic";
const BUCKET = "audiobook-private";
const MAX_BYTES = 1000 * 1024 * 1024; // samma som studio_service (MAX_BYTES) och bucketens gräns
const EXTS = new Set(["wav", "mp3", "m4a", "aif", "aiff", "flac"]);
const noStore = { "Cache-Control": "private, no-store" };

export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length")) > 4096) return new Response(null, { status: 413 });
  const url = process.env.AUDIOBOOK_STORAGE_URL, key = process.env.AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Uppladdning till lagringen är inte konfigurerad." }, { status: 503, headers: noStore });
  let body: { filename?: unknown; size?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "Ogiltig förfrågan." }, { status: 400, headers: noStore }); }
  const filename = String(body.filename || "").slice(0, 255), size = Number(body.size);
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  if (!EXTS.has(ext)) return Response.json({ error: "Filtypen stöds inte. Använd WAV, MP3, M4A, AIFF eller FLAC." }, { status: 415, headers: noStore });
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) return Response.json({ error: "Filen får vara högst 1000 MB." }, { status: 413, headers: noStore });
  const who = (verifyStudioToken(req.cookies.get(STUDIO_COOKIE)?.value) || "local").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40) || "local";
  const path = `studio/${who}/${randomUUID()}.${ext}`;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return Response.json({ error: "Kunde inte förbereda uppladdningen." }, { status: 502, headers: noStore });
  const endpoint = new URL(url); endpoint.hostname = endpoint.hostname.replace(".supabase.co", ".storage.supabase.co");
  return Response.json({ bucket: BUCKET, path, token: data.token, endpoint: endpoint.origin + "/storage/v1/upload/resumable/sign" }, { headers: noStore });
}
