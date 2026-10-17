"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wordmark } from "../../../components/saltwaves-ui";
import { buildChain, loadLimiter, predict, dbToLin, linToDb, type Chain, type Params, type Spec } from "@/lib/studio-chain";
import { studioTusUpload } from "@/lib/studio-upload";
import "../audiobook.css";
import "./studio.css";

const API = "/api/audiobook-studio";
type Check = { id: string; label: string; value: number | string | null; unit: string; requirement: string; pass: boolean; required?: boolean };
type Measure = { lufs: number | null; true_peak: number | null; lra: number | null; rms: number; sample_peak: number; noise_floor: number; checks: Check[]; pass: boolean; applied_gain_db?: number; noise_expander?: Record<string, number> | null; source?: "original" | "delivery" };
type Versions = Record<string, { lufs: number | null; meta?: { prenorm_gain_db: number; input_lufs: number } }>;
type Declick = "av" | "lag" | "hog"; type Klang = "varm" | "neutral" | "ljus";
type Mic = "dynamic" | "condenser";
const MICS: [Mic, string][] = [["dynamic", "Dynamisk"], ["condenser", "Kondensator"]];
type Preset = { name: string; label?: string; declick: Declick; klang: Klang; mic?: Mic | null; saved: number };
// Måste matcha KLANG i backend/studio_engine.py (saltwaves-audiobook).
const KLANG: Record<Klang, { low: number; high: number }> = { varm: { low: 1.5, high: -1.5 }, neutral: { low: 0, high: 0 }, ljus: { low: -1, high: 2 } };
const lockedParams = (k: Klang): Params => ({ hpf: 0, low: { f: 200, g: KLANG[k].low }, mid: { f: 1000, g: 0, q: 1 }, high: { f: 6000, g: KLANG[k].high }, comp: { on: false, threshold: -24, ratio: 2.5, attack: 10, release: 150, knee: 4 }, deess: { on: false, freq: 6000, threshold: -32, ratio: 4 }, limiter: { ceiling: -3.5 }, declick: false, dfn: true });
const VERSION_KEYS = ["locked_av", "locked_lag", "locked_hog"] as const;
const f1 = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d).replace("-", "−"));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}/${path}`, init);
  if (!r.ok) { let m = `Fel ${r.status}`; try { m = (await r.json()).detail || m; } catch { /* text */ } throw new Error(m); }
  return r.json();
}
async function decode(url: string, ctx: BaseAudioContext) { return ctx.decodeAudioData(await (await fetch(url)).arrayBuffer()); }

type Region = { start: number; length: number };
const MIN_REGION = 60, MAX_REGION = 300, DEFAULT_REGION = 120;
const fitRegion = (start: number, length: number, total: number): Region => {
  const len = Math.min(Math.max(MIN_REGION, Math.min(MAX_REGION, length)), total);
  return { start: Math.max(0, Math.min(start, total - len)), length: len };
};
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function Waveform({ buffer, position, onSeek, region, onRegion }: { buffer: AudioBuffer | null; position: number; onSeek: (t: number) => void; region?: Region | null; onRegion?: (r: Region) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ mode: "move" | "l" | "r"; x0: number; r0: Region; moved: boolean } | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c || !buffer) return;
    const w = c.width = c.clientWidth * 2, h = c.height = 160, g = c.getContext("2d")!;
    const d = buffer.getChannelData(0), step = Math.max(1, Math.floor(d.length / w));
    g.clearRect(0, 0, w, h);
    if (region) { const x0 = region.start / buffer.duration * w, x1 = (region.start + region.length) / buffer.duration * w; g.fillStyle = "rgba(230,107,56,.14)"; g.fillRect(x0, 0, x1 - x0, h); g.fillStyle = "#e66b38"; g.fillRect(x0, 0, 4, h); g.fillRect(x1 - 4, 0, 4, h); }
    g.fillStyle = "#24241f";
    for (let x = 0; x < w; x++) { let p = 0; for (let i = x * step; i < (x + 1) * step && i < d.length; i++) p = Math.max(p, Math.abs(d[i])); const y = p * h / 2; g.fillRect(x, h / 2 - y, 1, Math.max(1, y * 2)); }
    g.fillStyle = "#1f5fbf"; g.fillRect(Math.floor(position / buffer.duration * w), 0, 3, h);
  }, [buffer, position, region]);
  const tAt = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (buffer?.duration ?? 0); };
  return <canvas className="st-wave" ref={ref}
    onPointerDown={e => {
      if (!buffer) return; const t = tAt(e);
      if (region && onRegion) {
        const px = buffer.duration / e.currentTarget.getBoundingClientRect().width * 8, end = region.start + region.length;
        const mode = Math.abs(t - region.start) < px ? "l" : Math.abs(t - end) < px ? "r" : t > region.start && t < end ? "move" : null;
        if (mode) { drag.current = { mode, x0: t, r0: region, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); return; }
      }
      onSeek(t);
      if (region && onRegion) onRegion(fitRegion(t, region.length, buffer.duration));
    }}
    onPointerMove={e => {
      const D = drag.current; if (!D || !buffer || !onRegion) return; const t = tAt(e), dt = t - D.x0;
      if (Math.abs(dt) > 0.2) D.moved = true; if (!D.moved) return;
      const end = D.r0.start + D.r0.length;
      if (D.mode === "move") onRegion(fitRegion(D.r0.start + dt, D.r0.length, buffer.duration));
      else if (D.mode === "l") { const s = Math.max(0, Math.min(t, end - MIN_REGION)); onRegion(fitRegion(Math.max(s, end - MAX_REGION), end - Math.max(s, end - MAX_REGION), buffer.duration)); }
      else { const en = Math.min(buffer.duration, Math.max(t, D.r0.start + MIN_REGION)); onRegion(fitRegion(D.r0.start, Math.min(MAX_REGION, en - D.r0.start), buffer.duration)); }
    }}
    onPointerUp={e => { const D = drag.current; drag.current = null; if (D && !D.moved) onSeek(tAt(e)); }} />;
}

function Checks({ m }: { m: Measure }) {
  return <table className="st-checks"><tbody>{m.checks.map(c => <tr key={c.id}><td>{c.label}</td><td>{typeof c.value === "number" ? `${f1(c.value)} ${c.unit}` : c.value ?? "—"}</td><td>{c.requirement}</td><td className={c.required === false ? "" : c.pass ? "st-ok" : "st-bad"}>{c.required === false ? "—" : c.pass ? "OK" : "Utanför"}</td></tr>)}</tbody></table>;
}

const noiseFails = (m: Measure) => m.checks.some(c => c.id === "noise" && !c.pass);
function NoiseHint({ m, onGo }: { m: Measure; onGo: () => void }) {
  if (!noiseFails(m)) return null;
  const v = m.checks.find(c => c.id === "noise")?.value;
  return <div className="st-hint" role="alert"><p><b>Brusgolvet klarar inte Storytels −80 dBFS</b>{typeof v === "number" ? ` (uppmätt ${f1(v)} dBFS i pauserna)` : ""}. Kör Full chain, som tar bort bruset.</p><button className="ab-master" onClick={onGo}>Gå till Full chain</button></div>;
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return <label className="st-slider"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /><b>{f1(value, step < 1 ? 1 : 0)} {unit}</b></label>;
}

function EqCurve({ p }: { p: Params }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const mk = (type: BiquadFilterType, f: number, g = 0, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.gain.value = g; b.Q.value = q; return b; };
    const v: Params = JSON.parse(JSON.stringify(p));
    const filters = [mk("highpass", Math.max(1, v.hpf), 0, -3.0103), mk("lowshelf", v.low.f, v.low.g), mk("peaking", v.mid.f, v.mid.g, v.mid.q), mk("highshelf", v.high.f, v.high.g)];
    const n = 300, freqs = new Float32Array(n).map((_, i) => 20 * Math.pow(1000, i / (n - 1)));
    const total = new Float32Array(n);
    for (const fl of filters) { const mag = new Float32Array(n), ph = new Float32Array(n); fl.getFrequencyResponse(freqs, mag, ph); mag.forEach((m, i) => { total[i] += linToDb(m); }); }
    const w = c.width = c.clientWidth * 2, h = c.height = 180, g = c.getContext("2d")!;
    g.clearRect(0, 0, w, h); g.strokeStyle = "#ddded5"; g.lineWidth = 1;
    for (const db of [-12, -6, 0, 6, 12]) { const y = h / 2 - db / 15 * h / 2; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = "#e66b38"; g.lineWidth = 4; g.beginPath();
    total.forEach((db, i) => { const x = i / (n - 1) * w, y = h / 2 - Math.max(-15, Math.min(15, db)) / 15 * h / 2; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
  }, [p]);
  return <canvas className="st-eq" ref={ref} />;
}

export default function StudioV1() {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [params, setParams] = useState<Params | null>(null);
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [orig, setOrig] = useState<AudioBuffer | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [exc, setExc] = useState<{ buffer: AudioBuffer; start: number } | null>(null);
  const [origUrl, setOrigUrl] = useState("");
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [delivery, setDelivery] = useState<{ measure: Measure; url: string } | null>(null);
  const [versions, setVersions] = useState<Versions | null>(null);
  const [buffers, setBuffers] = useState<Record<string, AudioBuffer>>({});
  const [listen, setListen] = useState<"processed" | "original">("processed");
  const [playing, setPlaying] = useState(false); const [pos, setPos] = useState(0);
  const [prediction, setPrediction] = useState<{ autoGainDb: number; level: number; truePeak: number; noise: number | null } | null>(null);
  const [live, setLive] = useState({ lufs: -Infinity, peak: -Infinity });
  const [monitorDb, setMonitorDb] = useState(0);
  const [presets, setPresets] = useState<Preset[]>([]); const [presetName, setPresetName] = useState(""); const [presetLabel, setPresetLabel] = useState("");
  const [mic, setMic] = useState<Mic | null>(null); const [declick, setDeclick] = useState<Declick>("av"); const [klang, setKlang] = useState<Klang>("neutral");
  // Internt läge (fria reglage) bara för Saltwaves: ?internal=1 eller NEXT_PUBLIC_STUDIO_INTERNAL=true. Avstängt som standard.
  const [internal] = useState(() => process.env.NEXT_PUBLIC_STUDIO_INTERNAL === "true" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("internal") === "1"));
  const [masterState, setMasterState] = useState<{ progress?: string; state?: string; result?: Measure; audio?: string; error?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null); const fullInput = useRef<HTMLInputElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<HTMLDivElement>(null); const fullBtn = useRef<HTMLButtonElement>(null);
  const [flashFull, setFlashFull] = useState(false);
  const goFull = () => { playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); setFlashFull(true); setTimeout(() => setFlashFull(false), 2500); setTimeout(() => fullBtn.current?.focus({ preventScroll: true }), 600); };
  const origP = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; started: number; offset: number; raf: number } | null>(null);
  const [origPlaying, setOrigPlaying] = useState(false); const [origPos, setOrigPos] = useState(0);
  const stopOrig = () => { const O = origP.current; if (O) { cancelAnimationFrame(O.raf); try { O.src.stop(); } catch { /* */ } void O.ctx.close(); origP.current = null; } setOrigPlaying(false); };
  const playOrig = (from: number) => {
    if (!orig) return; stopOrig(); stopLive();
    const ctx = new AudioContext(); const src = ctx.createBufferSource(); src.buffer = orig; src.connect(ctx.destination);
    const when = ctx.currentTime + 0.03; src.start(when, Math.min(from, orig.duration - 0.01));
    const O = { ctx, src, started: when, offset: from, raf: 0 }; origP.current = O; setOrigPlaying(true);
    src.onended = () => { if (origP.current === O) stopOrig(); };
    const tick = () => { if (origP.current !== O) return; setOrigPos(Math.min(orig.duration, O.offset + Math.max(0, ctx.currentTime - O.started))); O.raf = requestAnimationFrame(tick); }; O.raf = requestAnimationFrame(tick);
  };
  const live$ = useRef<{ ctx: AudioContext; chain: Chain; srcs: AudioBufferSourceNode[]; vg: Record<string, GainNode>; og: GainNode; wet: GainNode; mon: GainNode; started: number; offset: number; kA: AnalyserNode; pA: AnalyserNode } | null>(null);

  useEffect(() => { api<{ spec: Spec; defaults: Params }>("specs").then(r => { setSpec(r.spec); setParams(r.defaults); }).catch(e => setError(`Studiotjänsten svarar inte: ${e.message}`)); api<{ presets: Preset[] }>("presets").then(r => setPresets(r.presets)).catch(() => {}); }, []);

  // Via preview-länken (https) går ljudet med tus direkt till lagringen, förbi Cloudflares 100 MB-gräns.
  // Lokalt och över Tailscale (http) används den direkta /upload som tidigare. ?tus=1 tvingar tus.
  const useTus = () => typeof window !== "undefined" && window.isSecureContext && (new URLSearchParams(location.search).get("tus") === "1" || !["localhost", "127.0.0.1"].includes(location.hostname));
  const uploadFile = async (f: File, onPct: (pct: number) => void = () => {}) => {
    if (useTus()) return studioTusUpload(f, API, (sent, total) => onPct(Math.floor(sent / total * 100)));
    const r = await fetch(`${API}/upload?filename=${encodeURIComponent(f.name)}`, { method: "POST", body: f, headers: { "content-type": "application/octet-stream" } });
    if (r.status === 413) throw new Error("Filen är större än 1000 MB.");
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Uppladdningen misslyckades");
    return r.json() as Promise<{ id: string; duration: number; filename: string }>;
  };

  const choose = async (f: File) => {
    stopLive(); stopOrig(); setError(""); setMeasure(null); setDelivery(null); setVersions(null); setBuffers({}); setExc(null); setMasterState(null); setPrediction(null);
    setBusy("Laddar upp och läser in…");
    try {
      const up = await uploadFile(f, pct => setBusy(`Laddar upp… ${pct} %`)); setBusy("Läser in och mäter…"); setFile({ id: up.id, name: up.filename });
      const url = `${API}/${up.id}/audio/original`; setOrigUrl(url);
      const b = await decode(url, new OfflineAudioContext(1, 1, 48000)); setOrig(b); setRegion(fitRegion(0, DEFAULT_REGION, b.duration)); setPos(0); setOrigPos(0);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };

  const doMeasure = async () => { if (!file) return; setBusy("Mäter…"); setError(""); try { setMeasure(await api<Measure>(`${file.id}/measure?source=${delivery ? "delivery" : "original"}`, { method: "POST" })); } catch (e) { setError((e as Error).message); } finally { setBusy(""); } };
  const doDelivery = async () => { if (!file) return; setDelivery(null); setMeasure(null); setBusy("Nivå, pausexpander, topp och limiter till Storytel…"); setError(""); try { const r = await api<{ measure: Measure; audio: string }>(`${file.id}/delivery-fix`, { method: "POST" }); setDelivery({ measure: r.measure, url: `${API}/${r.audio}?t=${Date.now()}` }); } catch (e) { setError((e as Error).message); } finally { setBusy(""); } };
  const doFull = async () => {
    if (!file || !orig) return; if (!mic) { setError("Välj mikrofontyp först."); return; } stopLive(); stopOrig();
    const rg = region ?? fitRegion(0, DEFAULT_REGION, orig.duration);
    if (rg.length < Math.min(MIN_REGION, orig.duration) - 0.01 || rg.length > MAX_REGION + 0.01) { setError("Utsnittet måste vara 1–5 minuter."); return; }
    setBusy(`Kör hela bearbetningskedjan på utsnittet ${mmss(rg.start)}–${mmss(rg.start + rg.length)}…`); setError("");
    const t0 = performance.now();
    try {
      const r = await api<{ versions: Versions }>(`${file.id}/full-chain?start=${rg.start.toFixed(3)}&length=${Math.max(MIN_REGION, rg.length).toFixed(3)}&mic=${mic}`, { method: "POST" });
      const ctx = new OfflineAudioContext(1, 1, 48000); const out: Record<string, AudioBuffer> = {};
      await Promise.all(VERSION_KEYS.map(async k => { out[k] = await decode(`${API}/${file.id}/audio/${k}?t=${Date.now()}`, ctx); }));
      const eb = await decode(`${API}/${file.id}/audio/excerpt?t=${Date.now()}`, ctx);
      const ex = (r.versions as unknown as { excerpt: Region }).excerpt;
      setExc({ buffer: eb, start: ex?.start ?? rg.start }); setPos(0);
      setBuffers(out); setVersions(r.versions);
      (window as unknown as { __studioFullMs?: number }).__studioFullMs = Math.round(performance.now() - t0);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };

  const current = `locked_${declick}`;
  const chainParams = internal ? params : lockedParams(klang);

  // Förutsäg mastern (offline, samma kedja) när inställningar ändras.
  useEffect(() => {
    if (!chainParams || !spec || !buffers[current]) return;
    let cancel = false; const t = setTimeout(async () => { const p = await predict(buffers[current], chainParams, spec); if (!cancel) setPrediction(p); }, 350);
    return () => { cancel = true; clearTimeout(t); };
  }, [chainParams, spec, buffers, current]);

  // Uppdatera live-kedjan direkt.
  useEffect(() => {
    const L = live$.current; if (!L || !chainParams) return;
    L.chain.update(chainParams, prediction?.autoGainDb ?? 0);
    const t = L.ctx.currentTime;
    for (const k of VERSION_KEYS) L.vg[k].gain.setTargetAtTime(k === current ? 1 : 0, t, 0.01);
    L.wet.gain.setTargetAtTime(listen === "processed" ? 1 : 0, t, 0.01);
    const origLufs = versions?.original.lufs ?? -23;
    L.og.gain.setTargetAtTime(listen === "original" ? dbToLin(Math.min(20, (spec?.target ?? -17.5) - origLufs)) : 0, t, 0.01);
    L.mon.gain.setTargetAtTime(dbToLin(monitorDb), t, 0.01);
  }, [chainParams, prediction, current, listen, versions, spec, monitorDb]);

  const stopLive = useCallback(() => { const L = live$.current; if (L) { L.srcs.forEach(s => { try { s.stop(); } catch { /* */ } }); L.ctx.close(); live$.current = null; } setPlaying(false); }, []);

  const playLive = async (from = pos) => {
    if (!chainParams || !exc || !buffers[current]) return;
    stopLive(); stopOrig();
    const ctx = new AudioContext({ sampleRate: 48000 }); await loadLimiter(ctx);
    const chain = buildChain(ctx, chainParams, prediction?.autoGainDb ?? 0, true);
    const meterIn = ctx.createGain(), mon = ctx.createGain(), wet = ctx.createGain(), og = ctx.createGain();
    chain.output.connect(wet).connect(meterIn); og.connect(meterIn); meterIn.connect(mon).connect(ctx.destination);
    const k1 = ctx.createBiquadFilter(); k1.type = "highshelf"; k1.frequency.value = 1682; k1.gain.value = 4;
    const k2 = ctx.createBiquadFilter(); k2.type = "highpass"; k2.frequency.value = 38; k2.Q.value = -6;
    const kA = ctx.createAnalyser(); kA.fftSize = 4096; const pA = ctx.createAnalyser(); pA.fftSize = 4096;
    meterIn.connect(k1).connect(k2).connect(kA); meterIn.connect(pA);
    const vg: Record<string, GainNode> = {}; const srcs: AudioBufferSourceNode[] = [];
    for (const k of VERSION_KEYS) { const s = ctx.createBufferSource(); s.buffer = buffers[k]; vg[k] = ctx.createGain(); vg[k].gain.value = k === current ? 1 : 0; s.connect(vg[k]).connect(chain.input); srcs.push(s); }
    const so = ctx.createBufferSource(); so.buffer = exc.buffer; so.connect(og); srcs.push(so);
    const when = ctx.currentTime + 0.05; srcs.forEach(s => s.start(when, from));
    srcs[0].onended = () => { if (live$.current?.srcs === srcs) { setPlaying(false); } };
    live$.current = { ctx, chain, srcs, vg, og, wet, mon, started: when, offset: from, kA, pA };
    setPlaying(true); setListen(l => l);
    setParams(p => p ? { ...p } : p);
  };
  useEffect(() => { if (live$.current && playing) live$.current.chain.update(lockedParams(klang), prediction?.autoGainDb ?? 0); }, [klang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mätare
  useEffect(() => {
    if (!playing) return; let raf = 0; const hist: number[] = []; const buf = new Float32Array(4096);
    const tick = () => {
      const L = live$.current; if (!L) return;
      setPos(Math.min(exc?.buffer.duration ?? 0, L.offset + L.ctx.currentTime - L.started));
      L.kA.getFloatTimeDomainData(buf); let e = 0; for (const v of buf) e += v * v; hist.push(e / buf.length); if (hist.length > 180) hist.shift();
      L.pA.getFloatTimeDomainData(buf); let pk = 0; for (const v of buf) pk = Math.max(pk, Math.abs(v));
      const ms = hist.reduce((a, b) => a + b, 0) / hist.length;
      setLive(prev => ({ lufs: -0.691 + 10 * Math.log10(ms + 1e-24) - monitorDb, peak: Math.max(linToDb(pk) - monitorDb, prev.peak - 0.3) }));
      raf = requestAnimationFrame(tick);
    }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [playing, exc, monitorDb]);

  const set = (fn: (p: Params) => Params) => setParams(p => p ? fn(structuredClone(p)) : p);

  const savePreset = async () => { if (!params || !presetName.trim() || !mic) return; try { await api("presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: presetName.trim(), label: presetLabel.trim(), declick, klang, mic }) }); setPresets((await api<{ presets: Preset[] }>("presets")).presets); } catch (e) { setError((e as Error).message); } };

  const masterFile = async (target: { id: string } | null, f?: File) => {
    if (!params) return; if (!mic) { setMasterState({ state: "failed", error: "Välj mikrofontyp först." }); return; } setError(""); setMasterState({ progress: "Laddar upp hela filen…", state: "running" });
    try {
      const id = f ? (await uploadFile(f, pct => setMasterState({ progress: `Laddar upp hela filen… ${pct} %`, state: "running" }))).id : target!.id;
      const { job } = await api<{ job: string }>(`${id}/master`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ declick, klang, mic, ...(internal ? { internal_params: params } : {}) }) });
      for (;;) { await new Promise(r => setTimeout(r, 1500)); const s = await api<{ state: string; progress: string; result?: Measure; audio?: string; error?: string }>(`jobs/${job}`); setMasterState(s); if (s.state !== "running") break; }
    } catch (e) { setMasterState({ state: "failed", error: (e as Error).message }); }
  };

  const ok = (v: number | null | undefined, lo: number, hi: number) => v !== null && v !== undefined && v >= lo && v <= hi;
  const levelOk = spec && prediction ? ok(prediction.level, spec.target - (spec.tolerance ?? 0.5), spec.target + (spec.tolerance ?? 0.5)) : false;
  const tpOk = spec && prediction ? prediction.truePeak <= spec.peak_max : false;
  const noiseOk = spec && prediction ? prediction.noise !== null && prediction.noise <= spec.noise_max : false;

  return <main className="ab-studio st">
    <header className="ab-header"><Wordmark href="/tools/audiobook" /><span className="ab-badge">SALTWAVES STUDIO · V1</span></header>
    <div className="ab-heading"><div><p className="ab-eyebrow">MÄT · LEVERANSFIX · HELA KEDJAN</p><h1>Hör ändringen<span>.</span></h1></div><p>Ladda upp filen, välj ett utsnitt på 1–5 minuter och kör Full chain. Lyssna, välj klang och spara ett preset. Mastra sedan hela filen med samma inställningar. <a href="/tools/audiobook">← Tillbaka till Audiobook</a></p></div>
    <div className="st-specbar" aria-label="Leveransspec"><b>Storytel</b><small>{spec?.note ?? "−17,5 LUFS ±0,5 · ≤ −3,0 dBTP · brus i pauser ≤ −80 dBFS (median) · 44,1 kHz/16 bit mono"}{spec?.source && <> · <a href={spec.source} target="_blank" rel="noreferrer">Storytels krav</a></>}</small></div>

    <section className="ab-workspace">
      <div className="ab-filebar"><div><span className="ab-eyebrow">01 · LJUDFIL</span><h2>{file?.name || "Välj ett utdrag"}</h2></div><button className="ab-secondary" disabled={!!busy} onClick={() => input.current?.click()}>{file ? "Byt fil" : "Välj ljudfil"}</button></div>
      <input ref={input} hidden type="file" accept=".wav,.mp3,.m4a,.aif,.aiff,.flac" onChange={e => { if (e.target.files?.[0]) void choose(e.target.files[0]); e.target.value = ""; }} />
      {!orig ? <div className="ab-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) void choose(e.dataTransfer.files[0]); }}><div className="ab-drop-icon">↑</div><p>Dra din ljudfil hit</p><span>WAV, MP3, M4A, AIFF eller FLAC · du väljer ett utsnitt på 1–5 min</span></div>
        : <div className="st-player" ref={playerRef}><Waveform buffer={orig} position={playing && exc ? exc.start + pos : origPos} region={region} onRegion={setRegion} onSeek={t => { setOrigPos(t); playOrig(t); }} /><div className="st-transport st-origbar"><button className="ab-play" aria-label={origPlaying ? "Pausa original" : "Spela original"} onClick={() => origPlaying ? stopOrig() : playOrig(origPos)}>{origPlaying ? "Ⅱ" : "▶"}</button><small>{mmss(origPos)} / {mmss(orig.duration)}</small></div>{region && <p className="st-note">Utsnitt för Full chain: {mmss(region.start)}–{mmss(region.start + region.length)} ({f1(region.length / 60)} min). Klicka i vågformen för att lyssna därifrån, dra i det markerade området eller i kanterna för att flytta eller ändra längd (1–5 min).</p>}</div>}
      <div className="st-mic st-choices" role="group" aria-label="Mikrofontyp"><span>Mikrofontyp</span>{MICS.map(([k, l]) => <button key={k} className="ab-secondary" aria-pressed={mic === k} onClick={() => { setMic(k); setError(""); }}>{l}</button>)}{!mic && <small>Välj före Full chain</small>}</div>
      <div className="st-actions" aria-label="Bearbetning">
        <button className="ab-secondary" disabled={!file || !!busy} onClick={() => void doMeasure()}><b>1 · Measure</b><span>{delivery ? "Mäter den leveransfixade filen" : "Loudness, true peak, LRA och brus i pauser mot Storytel"}</span></button>
        <button className="ab-secondary" disabled={!file || !!busy} onClick={() => void doDelivery()}><b>2 · Delivery-fix</b><span>Nivå, pausexpander och limiter till Storytel</span></button>
        <button ref={fullBtn} className={`ab-master${flashFull ? " st-flash" : ""}`} disabled={!file || !!busy || !mic} title={!mic ? "Välj mikrofontyp först" : undefined} onClick={() => void doFull()}><b>3 · Full chain</b><span>Hela kedjan på det valda utsnittet (1–5 min), sedan studiovyn</span></button>
      </div>
      {busy && <p className="ab-status" role="status"><span className="ab-spinner" />{busy}</p>}
      {error && <p className="ab-error" role="alert">{error}</p>}
      {measure && <div className="st-panel"><h3>{measure.source === "delivery" ? "Mätning efter leveransfix" : "Mätning av originalet"} {measure.pass ? <em className="st-ok">klarar specen</em> : <em className="st-bad">klarar inte specen</em>}</h3><NoiseHint m={measure} onGo={goFull} /><Checks m={measure} /></div>}
      {delivery && <div className="st-panel"><h3>Mätning av leveransfixen {delivery.measure.pass ? <em className="st-ok">klarar specen</em> : <em className="st-bad">utanför spec: {delivery.measure.checks.filter(c => c.required !== false && !c.pass).map(c => c.label).join(", ")}</em>}</h3><p className="st-note">Den fixade filen är mätt på nytt (44,1 kHz/16 bit efter dither, brus i pauser enligt pausmätningen). Nivå {delivery.measure.applied_gain_db !== undefined ? `${delivery.measure.applied_gain_db >= 0 ? "+" : ""}${f1(delivery.measure.applied_gain_db)} dB` : "—"}. Pausexpander alltid på (stänger under −55 dBFS, hold 60 ms, release 150 ms, golv ≈ −87 dBFS).</p><NoiseHint m={delivery.measure} onGo={goFull} /><audio src={delivery.url} controls /><Checks m={delivery.measure} />{delivery.measure.pass ? <a className="ab-secondary" href={delivery.url} download>Ladda ner WAV</a> : <><p className="st-bad st-note"><b>Filen klarar inte Storytel-specen</b> ({delivery.measure.checks.filter(c => c.required !== false && !c.pass).map(c => c.label).join(", ")}). Den kan laddas ner, men bör inte levereras.</p><a className="ab-secondary st-bad-link" href={delivery.url} download={`${(file?.name || "fil").replace(/\.[^.]+$/, "")}-delivery-KLARAR-INTE-SPEC.wav`}>Ladda ner WAV (klarar inte specen)</a></>}</div>}
    </section>

    {versions && params && spec && <section className="st-adjust">
      <div className="st-adjust-head"><div><p className="ab-eyebrow">02 · LYSSNA OCH VÄLJ</p><h2>Din master</h2><p>Brusreducering, EQ, kompression, de-esser, limiter och nivå sätts automatiskt utifrån materialet. Pausexpander och nivå till Storytel (−17,5 LUFS) ingår alltid. Du väljer klickborttagning och klang.</p></div>
        <div className="st-transport"><button className="ab-play" aria-label={playing ? "Pausa" : "Spela"} onClick={() => playing ? stopLive() : void playLive()}>{playing ? "Ⅱ" : "▶"}</button><div className="ab-switch" role="group" aria-label="A/B"><button aria-pressed={listen === "original"} onClick={() => setListen("original")}>A · Original</button><button aria-pressed={listen === "processed"} onClick={() => setListen("processed")}>B · Bearbetat</button></div><small>Nivåmatchat</small></div></div>
      {exc && <div className="st-excerpt"><p className="st-note">Utsnitt {mmss(exc.start)}–{mmss(exc.start + exc.buffer.duration)}. Klicka var som helst för att spela A/B därifrån.</p><Waveform buffer={exc.buffer} position={pos} onSeek={t => { stopOrig(); setPos(t); void playLive(t); }} /></div>}
      <div className="st-choices">
        <div role="group" aria-label="Klickborttagning"><span>Klickborttagning</span>{([["av", "Av"], ["lag", "Låg"], ["hog", "Hög"]] as const).map(([k, l]) => <button key={k} className="ab-secondary" aria-pressed={declick === k} onClick={() => setDeclick(k)}>{l}</button>)}</div>
        {!internal && <div role="group" aria-label="Klang"><span>Klang</span>{([["varm", "Varm"], ["neutral", "Neutral"], ["ljus", "Ljus"]] as const).map(([k, l]) => <button key={k} className="ab-secondary" aria-pressed={klang === k} onClick={() => setKlang(k)}>{l}</button>)}</div>}
      </div>
      <div className="st-meters st-meters-3">
        <div className={levelOk ? "st-ok" : "st-bad"}><span>Förväntad master, integrerad</span><b>{prediction ? f1(prediction.level) : "…"} LUFS</b><small>Krav {f1(spec.target - (spec.tolerance ?? 0.5))} till {f1(spec.target + (spec.tolerance ?? 0.5))}</small></div>
        <div className={tpOk ? "st-ok" : "st-bad"}><span>Förväntad true peak</span><b>{prediction ? f1(prediction.truePeak) : "…"} dBTP</b><small>Krav ≤ {f1(spec.peak_max)}</small></div>
        <div className={noiseOk ? "st-ok" : "st-bad"}><span>Förväntat brus i pauser (median)</span><b>{prediction ? f1(prediction.noise) : "…"} dBFS</b><small>Krav ≤ {f1(spec.noise_max, 0)} · före dither</small></div>
      </div>
      {internal && <div className="st-grid"><p className="st-note">Internt läge: fria reglage ovanpå den automatiska kedjan (ersätter klang).</p>
        <div className="st-box"><h3>EQ</h3><EqCurve p={params} />
          <Slider label="Högpass" value={params.hpf} min={0} max={200} step={5} unit="Hz" onChange={v => set(p => ({ ...p, hpf: v }))} />
          <Slider label="Bas, nivå" value={params.low.g} min={-12} max={12} step={0.5} unit="dB" onChange={v => set(p => { p.low.g = v; return p; })} />
          <Slider label="Mellan, frekvens" value={params.mid.f} min={300} max={6000} step={50} unit="Hz" onChange={v => set(p => { p.mid.f = v; return p; })} />
          <Slider label="Mellan, nivå" value={params.mid.g} min={-12} max={12} step={0.5} unit="dB" onChange={v => set(p => { p.mid.g = v; return p; })} />
          <Slider label="Diskant, nivå" value={params.high.g} min={-12} max={12} step={0.5} unit="dB" onChange={v => set(p => { p.high.g = v; return p; })} /></div>
        <div className="st-box"><h3>Dynamik</h3>
          <label><input type="checkbox" checked={params.comp.on} onChange={e => set(p => { p.comp.on = e.target.checked; return p; })} /> Kompressor</label>
          <Slider label="Tröskel" value={params.comp.threshold} min={-50} max={0} step={1} unit="dB" onChange={v => set(p => { p.comp.threshold = v; return p; })} />
          <Slider label="Ratio" value={params.comp.ratio} min={1} max={10} step={0.5} unit=":1" onChange={v => set(p => { p.comp.ratio = v; return p; })} />
          <label><input type="checkbox" checked={params.deess.on} onChange={e => set(p => { p.deess.on = e.target.checked; return p; })} /> De-esser</label>
          <Slider label="De-ess tröskel" value={params.deess.threshold} min={-60} max={0} step={1} unit="dB" onChange={v => set(p => { p.deess.threshold = v; return p; })} />
          <Slider label="Limitertak" value={params.limiter.ceiling} min={-6} max={-3.3} step={0.1} unit="dB" onChange={v => set(p => { p.limiter.ceiling = v; return p; })} />
          <Slider label="Lyssningsvolym" value={monitorDb} min={-20} max={6} step={0.5} unit="dB" onChange={setMonitorDb} /></div></div>}
      <div className="st-panel"><h3>Presets</h3>
        <div className="st-preset"><input placeholder="Namn" value={presetName} onChange={e => setPresetName(e.target.value)} /><input placeholder="Inläsare eller bok (valfritt)" value={presetLabel} onChange={e => setPresetLabel(e.target.value)} /><button className="ab-secondary" disabled={!presetName.trim() || !mic} onClick={() => void savePreset()}>Spara</button></div>
        <ul className="st-presets">{presets.map(p => <li key={p.name}><button className="ab-secondary" title={`${p.label || ""} ${p.declick}/${p.klang}/${p.mic ?? "mic saknas"}`} onClick={() => { setDeclick(p.declick); setKlang(p.klang); setMic(p.mic ?? null); if (!p.mic) setError(`Presetet "${p.name}" saknar mikrofontyp. Välj Dynamisk eller Kondensator.`); setPresetName(p.name); setPresetLabel(p.label || ""); }}>{p.name}{p.label ? ` · ${p.label}` : ""}</button></li>)}</ul>
      </div>
      <div className="st-panel"><p className="ab-eyebrow">03 · MASTRA HELA FILEN</p><p>Samma automatiska kedja och dina val körs på hela filen. Exporten blir 44,1 kHz, 16 bit mono med dither.</p>
        <div className="st-row"><button className="ab-master" disabled={masterState?.state === "running" || !mic} onClick={() => fullInput.current?.click()}>Välj hela filen och mastra</button><button className="ab-secondary" disabled={masterState?.state === "running" || !mic} onClick={() => void masterFile(file)} >Mastra den här filen</button></div>
        <input ref={fullInput} hidden type="file" accept=".wav,.mp3,.m4a,.aif,.aiff,.flac" onChange={e => { if (e.target.files?.[0]) void masterFile(null, e.target.files[0]); e.target.value = ""; }} />
        {masterState?.state === "running" && <p className="ab-status"><span className="ab-spinner" />{masterState.progress}</p>}
        {masterState?.state === "failed" && <p className="ab-error">{masterState.error}</p>}
        {masterState?.state === "done" && masterState.result && <><h3>Master {masterState.result.pass ? <em className="st-ok">klarar specen</em> : <em className="st-bad">utanför spec</em>}</h3><Checks m={masterState.result} /><a className="ab-master" href={`${API}/${masterState.audio}`} download>Ladda ner master</a></>}
      </div>
    </section>}
    <footer className="ab-footer"><span>SALTWAVES STUDIO</span><span>En fil. En enhetlig behandling.</span></footer>
  </main>;
}
