// Portalen: tus-uppladdning (6 MiB-bitar, återupptagbar) direkt till lagringen. Returnerar objektets sökväg.
import { Upload } from "tus-js-client";
type Grant = { bucket: string; path: string; token: string; endpoint: string };
export async function portalTusUpload(file: File, grantUrl: string, onProgress: (sent: number, total: number) => void): Promise<string> {
  const r = await fetch(grantUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size }) });
  const g = await r.json().catch(() => ({})) as Grant & { error?: string };
  if (!r.ok) throw new Error(g.error || "Uppladdningen kunde inte förberedas.");
  await new Promise<void>((resolve, reject) => {
    const up = new Upload(file, {
      endpoint: g.endpoint, headers: { "x-signature": g.token }, chunkSize: 6 * 1024 * 1024, uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true, retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      metadata: { bucketName: g.bucket, objectName: g.path, contentType: file.type || "application/octet-stream" },
      fingerprint: async () => `portal:${g.path}`, onProgress, onSuccess: () => resolve(),
      onError: () => reject(new Error("Uppladdningen avbröts. Försök igen.")),
    });
    up.start();
  });
  return g.path;
}
export const ACCEPT = ".wav,.mp3,.m4a,.aif,.aiff,.flac";
