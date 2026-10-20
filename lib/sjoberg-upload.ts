// Sjöberg-sidan: samma tus-uppladdning som Studio v1, men fungerar även utan säker kontext (http via Tailscale).
// Studio v1: tus-uppladdning (6 MiB-bitar) med återupptagning, som ljudbokspilotens lib/audiobook-client.ts.
import { Upload } from "tus-js-client";
type Grant = { bucket: string; path: string; token: string; endpoint: string; created: number };
const GRANT_TTL_MS = 110 * 60 * 1000; // signerade upload-tokens gäller 2 h

async function json<T>(r: Response): Promise<T> { const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.error || d.detail || `Fel ${r.status}`), { status: r.status }); return d as T; }

function fnv(buf: ArrayBuffer) { let h = 0x811c9dc5; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }
export async function sjobergTusUpload(file: File, api: string, onProgress: (sent: number, total: number) => void): Promise<{ id: string; duration: number; resumed: boolean }> {
  const sample = await new Blob([file.slice(0, 65536), file.slice(Math.max(65536, file.size - 65536))]).arrayBuffer();
  const hash = globalThis.crypto?.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", sample))).map(v => v.toString(16).padStart(2, "0")).join("") : fnv(sample);
  const storageKey = "sjoberg-resume:" + JSON.stringify([file.name, file.size, file.lastModified, hash]);
  const clear = () => { try { localStorage.removeItem(storageKey); } catch { /* */ } };
  let grant: Grant | null = null, resumed = false;
  try { const g = JSON.parse(localStorage.getItem(storageKey) || "null") as Grant | null; if (g && Date.now() - g.created < GRANT_TTL_MS) { grant = g; resumed = true; } } catch { /* */ }
  if (!grant) {
    grant = { ...(await json<Omit<Grant, "created">>(await fetch(`${api}/tus`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size }) }))), created: Date.now() };
    try { localStorage.setItem(storageKey, JSON.stringify(grant)); } catch { /* återupptagning i samma flik fungerar ändå */ }
  }
  const g = grant;
  await new Promise<void>((resolve, reject) => {
    const up = new Upload(file, {
      endpoint: g.endpoint, headers: { "x-signature": g.token }, chunkSize: 6 * 1024 * 1024, uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true, retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      metadata: { bucketName: g.bucket, objectName: g.path, contentType: file.type || "application/octet-stream" },
      fingerprint: async () => `sjoberg:${g.path}`, onProgress, onSuccess: () => resolve(),
      onError: e => { const st = (e as { originalResponse?: { getStatus(): number } }).originalResponse?.getStatus?.(); if (st === 400 || st === 401 || st === 403 || st === 404 || st === 410) clear(); reject(new Error("Uppladdningen avbröts. Välj samma fil igen för att fortsätta där den slutade.")); },
    });
    void up.findPreviousUploads().then(prev => { if (prev[0]) { resumed = true; up.resumeFromPreviousUpload(prev[0]); } up.start(); }).catch(reject);
  });
  const res = await json<{ id: string; duration: number }>(await fetch(`${api}/ingest`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: g.path, filename: file.name }) }));
  clear();
  return { ...res, resumed };
}
