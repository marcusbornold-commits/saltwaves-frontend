// Tus-uppladdning till Open Doors privata lagring (samma mönster som Sjöberg).
import { Upload } from "tus-js-client";
type Grant = { bucket: string; path: string; token: string; endpoint: string; created: number };
const GRANT_TTL_MS = 110 * 60 * 1000;

async function json<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || d.detail || `Fel ${r.status}`), { status: r.status });
  return d as T;
}

export async function opendoorsTusUpload(
  file: File,
  api: string,
  onProgress: (sent: number, total: number) => void,
): Promise<{ path: string; resumed: boolean }> {
  const storageKey = "opendoors-resume:" + JSON.stringify([file.name, file.size, file.lastModified]);
  const clear = () => { try { localStorage.removeItem(storageKey); } catch { /* */ } };
  let grant: Grant | null = null, resumed = false;
  try {
    const g = JSON.parse(localStorage.getItem(storageKey) || "null") as Grant | null;
    if (g && Date.now() - g.created < GRANT_TTL_MS) { grant = g; resumed = true; }
  } catch { /* */ }
  if (!grant) {
    grant = { ...(await json<Omit<Grant, "created">>(await fetch(`${api}/tus`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: file.name, size: file.size }),
    }))), created: Date.now() };
    try { localStorage.setItem(storageKey, JSON.stringify(grant)); } catch { /* */ }
  }
  const g = grant;
  await new Promise<void>((resolve, reject) => {
    const up = new Upload(file, {
      endpoint: g.endpoint,
      headers: { "x-signature": g.token },
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      metadata: { bucketName: g.bucket, objectName: g.path, contentType: file.type || "application/octet-stream" },
      fingerprint: async () => `opendoors:${g.path}`,
      onProgress,
      onSuccess: () => resolve(),
      onError: e => {
        const st = (e as { originalResponse?: { getStatus(): number } }).originalResponse?.getStatus?.();
        if (st === 400 || st === 401 || st === 403 || st === 404 || st === 410) clear();
        reject(new Error("Uppladdningen avbröts. Välj samma fil igen för att fortsätta där den slutade."));
      },
    });
    void up.findPreviousUploads().then(prev => {
      if (prev[0]) { resumed = true; up.resumeFromPreviousUpload(prev[0]); }
      up.start();
    }).catch(reject);
  });
  clear();
  return { path: g.path, resumed };
}
