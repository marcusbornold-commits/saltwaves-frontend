import { NextRequest } from "next/server";
import {
  RETENTION_DAYS, TENANT, backend, db, fail, isUuid, noStore, signed, tusGrant, tusPathOk,
  markDelivered, markFailed, uploadLocalFromApi, type Analysis,
} from "@/lib/opendoors-portal";
import { logEvent, whoFrom } from "@/lib/opendoors-events";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const MIC = new Set(["dynamic", "condenser", "headset"]);

async function episode(id: string) {
  if (!isUuid(id)) return null;
  const { data } = await db().from("opendoors_episodes").select("*").eq("id", id).eq("tenant", TENANT).maybeSingle();
  return data;
}
async function tracksOf(id: string) {
  const { data } = await db().from("opendoors_tracks").select("id, name, original_filename, mic_type, is_room, sort_order, tus_path, storage_path, duration_s, created_at").eq("episode_id", id).order("sort_order").order("created_at");
  return data || [];
}

const pubEp = (e: Record<string, unknown>, tracks?: unknown[], urls?: Record<string, string | null>) => ({
  id: e.id,
  title: e.title,
  show_name: e.show_name,
  status: e.status,
  error: e.error,
  created_at: e.created_at,
  delivered_at: e.delivered_at,
  expires_at: e.expires_at,
  analysis: e.analysis,
  retention_days: RETENTION_DAYS,
  tracks,
  files: urls,
});

async function fileUrls(e: { storage_path_wav: string | null; storage_path_mp3: string | null; storage_path_raw: string | null }) {
  const one = async (p: string | null) => (p ? signed(p).catch(() => null) : null);
  // raw.mp3 lives next to raw.wav
  const rawMp3 = e.storage_path_raw ? e.storage_path_raw.replace(/raw\.wav$/, "raw.mp3") : null;
  return {
    master_wav: await one(e.storage_path_wav),
    master_mp3: await one(e.storage_path_mp3),
    raw_wav: await one(e.storage_path_raw),
    raw_mp3: await one(rawMp3),
  };
}

async function finishIfReady(id: string) {
  const r = await backend(`episodes/${id}`, undefined, 30000).catch(() => null);
  if (!r || !r.ok) return;
  const d = await r.json();
  if (d.state === "failed" || d.status === "failed") {
    await markFailed(id, d.error || "Bearbetningen kunde inte slutföras.");
    void logEvent("server", "failed", id);
    return;
  }
  if (d.status === "done" || d.result) {
    const wav = await uploadLocalFromApi(id, "master.wav");
    const mp3 = await uploadLocalFromApi(id, "master.mp3");
    const raw = await uploadLocalFromApi(id, "raw.wav");
    await uploadLocalFromApi(id, "raw.mp3");
    let analysis: Analysis | null = null;
    try {
      const a = await backend(`episodes/${id}/files/analysis.json`, undefined, 30000);
      if (a.ok) analysis = await a.json();
    } catch { /* */ }
    await markDelivered(id, { wav, mp3, raw }, analysis);
    void logEvent("server", "done", id);
  }
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const p = (await ctx.params).path || [];
  const m = req.method;
  const who = whoFrom(req);
  const sb = db();
  const body = async () => { try { return await req.json(); } catch { return {}; } };
  try {
    if (p.length === 1 && p[0] === "episodes" && m === "GET") {
      const { data } = await sb.from("opendoors_episodes").select("id, title, show_name, status, error, created_at, delivered_at, expires_at").eq("tenant", TENANT).order("created_at", { ascending: false }).limit(200);
      return Response.json({ episodes: data || [] }, { headers: noStore });
    }
    if (p.length === 1 && p[0] === "episodes" && m === "POST") {
      const x = await body();
      const title = str(x.title, 200);
      if (!title) return fail("Ange en titel för avsnittet.");
      const { data, error } = await sb.from("opendoors_episodes").insert({
        title,
        show_name: str(x.show_name, 200) || "Motljus",
        notify_email: str(x.notify_email, 200) || null,
        status: "draft",
      }).select("id, title, show_name, status").single();
      if (error || !data) return fail("Avsnittet kunde inte skapas.", 502);
      void logEvent(who, "upload", data.id, { action: "create", title: data.title });
      return Response.json(data, { headers: noStore });
    }
    if (p.length === 2 && p[0] === "episodes" && isUuid(p[1]) && m === "GET") {
      const e = await episode(p[1]);
      if (!e) return fail("Avsnittet hittades inte.", 404);
      if (e.status === "processing") await finishIfReady(e.id).catch(() => undefined);
      const fresh = (await episode(p[1])) || e;
      const tracks = await tracksOf(fresh.id);
      const urls = fresh.status === "done" ? await fileUrls(fresh) : undefined;
      return Response.json(pubEp(fresh, tracks, urls), { headers: noStore });
    }
    if (p.length === 3 && p[0] === "episodes" && isUuid(p[1]) && p[2] === "tus" && m === "POST") {
      const e = await episode(p[1]);
      if (!e) return fail("Avsnittet hittades inte.", 404);
      const x = await body();
      return tusGrant(`inbox/${e.id}`, String(x.filename || ""), Number(x.size));
    }
    if (p.length === 3 && p[0] === "episodes" && isUuid(p[1]) && p[2] === "tracks" && m === "POST") {
      const e = await episode(p[1]);
      if (!e) return fail("Avsnittet hittades inte.", 404);
      const x = await body();
      const path = str(x.path, 500);
      if (!tusPathOk(`inbox/${e.id}`, path)) return fail("Ogiltig uppladdning.");
      const mic = str(x.mic_type || x.mic, 20) || "dynamic";
      if (!MIC.has(mic)) return fail("Ogiltig mikrofontyp.");
      const { data: rows } = await sb.from("opendoors_tracks").select("sort_order").eq("episode_id", e.id).order("sort_order", { ascending: false }).limit(1);
      const sort = (rows?.[0]?.sort_order ?? -1) + 1;
      const { data, error } = await sb.from("opendoors_tracks").insert({
        episode_id: e.id,
        name: str(x.name, 200) || "Spår",
        original_filename: str(x.filename, 255) || "spår.wav",
        mic_type: mic,
        is_room: !!x.is_room,
        sort_order: sort,
        tus_path: path,
        storage_path: path,
      }).select("id, name, mic_type, original_filename").single();
      if (error || !data) return fail("Spåret kunde inte sparas.", 502);
      if (e.status === "draft") await sb.from("opendoors_episodes").update({ status: "uploading", updated_at: new Date().toISOString() }).eq("id", e.id);
      void logEvent(who, "upload", e.id, { track: data.id, filename: data.original_filename });
      return Response.json(data, { headers: noStore });
    }
    if (p.length === 3 && p[0] === "episodes" && isUuid(p[1]) && p[2] === "start" && m === "POST") {
      const e = await episode(p[1]);
      if (!e) return fail("Avsnittet hittades inte.", 404);
      const tracks = await tracksOf(e.id);
      if (tracks.length < 2) return fail("Ladda upp minst två spår, ett per mikrofon eller talare.");
      const payload = {
        mode: "standard_v2",
        tracks: tracks.map(t => ({
          name: t.name,
          mic: t.mic_type,
          filename: t.original_filename,
          room: t.is_room,
          storage_path: t.storage_path || t.tus_path,
        })),
      };
      const r = await backend(`episodes/${e.id}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        return fail(d.detail || d.error || "Bearbetningen kunde inte startas.", r.status === 400 ? 400 : 502);
      }
      const d = await r.json();
      await sb.from("opendoors_episodes").update({ status: "processing", backend_job: d.job_id || null, error: null, updated_at: new Date().toISOString() }).eq("id", e.id);
      void logEvent(who, "start", e.id, { tracks: tracks.length });
      return Response.json({ ok: true, job: d.job_id }, { headers: noStore });
    }
    if (p.length === 4 && p[0] === "episodes" && isUuid(p[1]) && p[2] === "files" && m === "GET") {
      const e = await episode(p[1]);
      if (!e || e.status !== "done") return fail("Filen är inte klar.", 404);
      const map: Record<string, string | null> = {
        "master.wav": e.storage_path_wav,
        "master.mp3": e.storage_path_mp3,
        "raw.wav": e.storage_path_raw,
        "raw.mp3": e.storage_path_raw ? String(e.storage_path_raw).replace(/raw\.wav$/, "raw.mp3") : null,
      };
      const path = map[p[3]];
      if (!path) return fail("Filen finns inte.", 404);
      const url = await signed(path);
      return Response.redirect(url, 302);
    }
  } catch (err) {
    console.error("opendoors api", (err as Error).message);
    return fail("Tjänsten svarar inte just nu. Försök igen om en stund.", 503);
  }
  return fail("Ogiltig förfrågan.", 404);
}
export const GET = handle;
export const POST = handle;
