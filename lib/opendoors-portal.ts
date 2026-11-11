// Open Doors portal: episodes/tracks in Supabase, tus to audiobook-private/opendoors-portal/, job to the test API.
import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { logEvent, notifyEpisodeDone } from "@/lib/opendoors-events";

export const BUCKET = "audiobook-private";
export const TENANT = "opendoors";
export const RETENTION_DAYS = 30;
export const MAX_BYTES = 1000 * 1024 * 1024;
export const EXTS = new Set(["wav", "mp3", "m4a", "flac"]);
export const PREFIX = "opendoors-portal";
export const noStore = { "Cache-Control": "private, no-store" };
export const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: noStore });
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

const env = () => {
  const url = process.env.AUDIOBOOK_STORAGE_URL, key = process.env.AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("storage not configured");
  return { url, key };
};
export function db() {
  const { url, key } = env();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const api = () => process.env.OPENDOORS_API_URL || "http://127.0.0.1:8795";
export const backend = (path: string, init?: RequestInit, ms = 600000) =>
  fetch(`${api()}/${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(ms) });

export async function tusGrant(folder: string, filename: string, size: number) {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  if (!EXTS.has(ext)) return fail("Filtypen stöds inte. Använd WAV, MP3, M4A eller FLAC.", 415);
  if (size === 0) return fail("Filen är tom.", 400);
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_BYTES) return fail("Filen får vara högst 1000 MB.", 413);
  const { url } = env();
  const path = `${PREFIX}/${folder}/${randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail("Kunde inte förbereda uppladdningen.", 502);
  const endpoint = new URL(url);
  endpoint.hostname = endpoint.hostname.replace(".supabase.co", ".storage.supabase.co");
  return Response.json({ bucket: BUCKET, path, token: data.token, endpoint: endpoint.origin + "/storage/v1/upload/resumable/sign" }, { headers: noStore });
}
export const tusPathOk = (folder: string, path: string) =>
  new RegExp(`^${PREFIX}/${folder}/[0-9a-f-]{36}\\.(wav|mp3|m4a|flac)$`).test(path);

export async function signed(path: string, seconds = 3600) {
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, seconds);
  if (!data?.signedUrl) throw new Error("sign");
  return data.signedUrl;
}

export async function uploadLocalFromApi(episodeId: string, name: "master.wav" | "master.mp3" | "raw.wav" | "raw.mp3" | "analysis.json") {
  const r = await backend(`episodes/${episodeId}/files/${name}`, undefined, 3600_000);
  if (!r.ok || !r.body) throw new Error("file");
  const { url, key } = env();
  const storagePath = `${PREFIX}/${episodeId}/${name}`;
  const ctype = name.endsWith(".mp3") ? "audio/mpeg" : name.endsWith(".json") ? "application/json" : "audio/wav";
  const h: Record<string, string> = { authorization: `Bearer ${key}`, apikey: key, "content-type": ctype, "x-upsert": "true" };
  const len = r.headers.get("content-length"); if (len) h["content-length"] = len;
  const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${storagePath}`, { method: "POST", headers: h, body: r.body, duplex: "half" } as RequestInit);
  if (!up.ok) throw new Error("store " + up.status);
  return storagePath;
}

export type Analysis = {
  target_lufs?: number;
  target_tp?: number;
  mode?: string;
  raw?: Record<string, unknown>;
  master?: Record<string, unknown>;
};

export async function markDelivered(episodeId: string, storage: { wav: string; mp3: string; raw: string }, analysis: Analysis | null) {
  const now = new Date();
  const expires = new Date(now.getTime() + RETENTION_DAYS * 86400e3);
  await db().from("opendoors_episodes").update({
    status: "done",
    error: null,
    storage_path_wav: storage.wav,
    storage_path_mp3: storage.mp3,
    storage_path_raw: storage.raw,
    analysis,
    delivered_at: now.toISOString(),
    expires_at: expires.toISOString(),
    updated_at: now.toISOString(),
  }).eq("id", episodeId).eq("tenant", TENANT);
  void notifyEpisodeDone(episodeId);
}

export async function markFailed(episodeId: string, error: string) {
  await db().from("opendoors_episodes").update({
    status: "failed",
    error,
    updated_at: new Date().toISOString(),
  }).eq("id", episodeId).eq("tenant", TENANT);
}

// Lists expired Open Doors objects (does not delete). Used by the cleanup script's dry-run counterpart.
export async function listExpired(): Promise<{ id: string; title: string; expires_at: string; paths: string[] }[]> {
  const { data } = await db().from("opendoors_episodes")
    .select("id, title, expires_at, storage_path_wav, storage_path_mp3, storage_path_raw")
    .lt("expires_at", new Date().toISOString())
    .not("storage_path_wav", "is", null);
  return (data || []).map(r => ({
    id: r.id,
    title: r.title,
    expires_at: r.expires_at,
    paths: [r.storage_path_wav, r.storage_path_mp3, r.storage_path_raw].filter((p): p is string => !!p && p.startsWith(PREFIX + "/")),
  }));
}
