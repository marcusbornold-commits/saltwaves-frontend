"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wordmark } from "../../../components/saltwaves-ui";
import { buildChain, loadLimiter, predict, dbToLin, linToDb, type Chain, type Params, type Spec } from "@/lib/studio-chain";
import "../audiobook.css";
import "./studio.css";

const API = "/api/audiobook-studio";
type Check = { id: string; label: string; value: number | string | null; unit: string; requirement: string; pass: boolean; required?: boolean };
type Measure = { lufs: number | null; true_peak: number | null; lra: number | null; rms: number; sample_peak: number; noise_floor: number; checks: Check[]; pass: boolean; applied_gain_db?: number };
type Versions = Record<string, { lufs: number | null; meta?: { prenorm_gain_db: number; input_lufs: number } }>;
type Preset = { name: string; spec: string; params: Params; saved: number };
const VERSION_KEYS = ["pre_d0", "pre_d1", "dfn_d0", "dfn_d1"] as const;
const f1 = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d).replace("-", "−"));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}/${path}`, init);
  if (!r.ok) { let m = `Fel ${r.status}`; try { m = (await r.json()).detail || m; } catch { /* text */ } throw new Error(m); }
  return r.json();
}
async function decode(url: string, ctx: BaseAudioContext) { return ctx.decodeAudioData(await (await fetch(url)).arrayBuffer()); }

function Waveform({ buffer, position, onSeek }: { buffer: AudioBuffer | null; position: number; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || !buffer) return;
    const w = c.width = c.clientWidth * 2, h = c.height = 160, g = c.getContext("2d")!;
    const d = buffer.getChannelData(0), step = Math.max(1, Math.floor(d.length / w));
    g.clearRect(0, 0, w, h); g.fillStyle = "#24241f";
    for (let x = 0; x < w; x++) { let p = 0; for (let i = x * step; i < (x + 1) * step && i < d.length; i++) p = Math.max(p, Math.abs(d[i])); const y = p * h / 2; g.fillRect(x, h / 2 - y, 1, Math.max(1, y * 2)); }
    g.fillStyle = "#e66b38"; g.fillRect(Math.floor(position / buffer.duration * w), 0, 3, h);
  }, [buffer, position]);
  return <canvas className="st-wave" ref={ref} onClick={e => { if (!buffer) return; const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width * buffer.duration); }} />;
}

function Checks({ m }: { m: Measure }) {
  return <table className="st-checks"><tbody>{m.checks.map(c => <tr key={c.id}><td>{c.label}</td><td>{typeof c.value === "number" ? `${f1(c.value)} ${c.unit}` : c.value ?? "—"}</td><td>{c.requirement}</td><td className={c.required === false ? "" : c.pass ? "st-ok" : "st-bad"}>{c.required === false ? "—" : c.pass ? "OK" : "Utanför"}</td></tr>)}</tbody></table>;
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
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [specId, setSpecId] = useState("storytel");
  const [params, setParams] = useState<Params | null>(null);
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [orig, setOrig] = useState<AudioBuffer | null>(null);
  const [origUrl, setOrigUrl] = useState("");
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [delivery, setDelivery] = useState<{ measure: Measure; url: string } | null>(null);
  const [versions, setVersions] = useState<Versions | null>(null);
  const [buffers, setBuffers] = useState<Record<string, AudioBuffer>>({});
  const [listen, setListen] = useState<"processed" | "original">("processed");
  const [playing, setPlaying] = useState(false); const [pos, setPos] = useState(0);
  const [prediction, setPrediction] = useState<{ autoGainDb: number; level: number; truePeak: number } | null>(null);
  const [live, setLive] = useState({ lufs: -Infinity, peak: -Infinity });
  const [monitorDb, setMonitorDb] = useState(0);
  const [presets, setPresets] = useState<Preset[]>([]); const [presetName, setPresetName] = useState("");
  const [masterState, setMasterState] = useState<{ progress?: string; state?: string; result?: Measure; audio?: string; error?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null); const fullInput = useRef<HTMLInputElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  const live$ = useRef<{ ctx: AudioContext; chain: Chain; srcs: AudioBufferSourceNode[]; vg: Record<string, GainNode>; og: GainNode; wet: GainNode; mon: GainNode; started: number; offset: number; kA: AnalyserNode; pA: AnalyserNode } | null>(null);
  const spec = specs.find(s => s.id === specId);

  useEffect(() => { api<{ specs: Spec[]; defaults: Params }>("specs").then(r => { setSpecs(r.specs); setParams(r.defaults); }).catch(e => setError(`Studiotjänsten svarar inte: ${e.message}`)); api<{ presets: Preset[] }>("presets").then(r => setPresets(r.presets)).catch(() => {}); }, []);

  const uploadFile = async (f: File) => {
    const r = await fetch(`${API}/upload?filename=${encodeURIComponent(f.name)}`, { method: "POST", body: f, headers: { "content-type": "application/octet-stream" } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Uppladdningen misslyckades");
    return r.json() as Promise<{ id: string; duration: number; filename: string }>;
  };

  const choose = async (f: File) => {
    stopLive(); setError(""); setMeasure(null); setDelivery(null); setVersions(null); setBuffers({}); setMasterState(null); setPrediction(null);
    setBusy("Laddar upp och läser in…");
    try {
      const up = await uploadFile(f); setFile({ id: up.id, name: up.filename });
      const url = `${API}/${up.id}/audio/original`; setOrigUrl(url);
      setOrig(await decode(url, new OfflineAudioContext(1, 1, 48000)));
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };

  const doMeasure = async () => { if (!file) return; setBusy("Mäter…"); setError(""); try { setMeasure(await api<Measure>(`${file.id}/measure?spec=${specId}`, { method: "POST" })); } catch (e) { setError((e as Error).message); } finally { setBusy(""); } };
  const doDelivery = async () => { if (!file) return; setBusy("Nivå, topp och limiter till spec…"); setError(""); try { const r = await api<{ measure: Measure; audio: string }>(`${file.id}/delivery-fix?spec=${specId}`, { method: "POST" }); setDelivery({ measure: r.measure, url: `${API}/${r.audio}?t=${Date.now()}` }); } catch (e) { setError((e as Error).message); } finally { setBusy(""); } };
  const doFull = async () => {
    if (!file) return; stopLive(); setBusy("Normaliserar till −23 LUFS och kör brusreducering och klickborttagning…"); setError("");
    try {
      const r = await api<{ versions: Versions }>(`${file.id}/full-chain`, { method: "POST" });
      const ctx = new OfflineAudioContext(1, 1, 48000); const out: Record<string, AudioBuffer> = {};
      await Promise.all(VERSION_KEYS.map(async k => { out[k] = await decode(`${API}/${file.id}/audio/${k}`, ctx); }));
      setBuffers(out); setVersions(r.versions);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };

  const current = params ? `${params.dfn ? "dfn" : "pre"}_d${params.declick ? 1 : 0}` : "dfn_d0";

  // Förutsäg mastern (offline, samma kedja) när inställningar ändras.
  useEffect(() => {
    if (!params || !spec || !buffers[current]) return;
    let cancel = false; const t = setTimeout(async () => { const p = await predict(buffers[current], params, spec); if (!cancel) setPrediction(p); }, 350);
    return () => { cancel = true; clearTimeout(t); };
  }, [params, spec, buffers, current]);

  // Uppdatera live-kedjan direkt.
  useEffect(() => {
    const L = live$.current; if (!L || !params) return;
    L.chain.update(params, prediction?.autoGainDb ?? 0);
    const t = L.ctx.currentTime;
    for (const k of VERSION_KEYS) L.vg[k].gain.setTargetAtTime(k === current ? 1 : 0, t, 0.01);
    L.wet.gain.setTargetAtTime(listen === "processed" ? 1 : 0, t, 0.01);
    const origLufs = versions?.original.lufs ?? -23;
    L.og.gain.setTargetAtTime(listen === "original" ? dbToLin(Math.min(20, (spec?.metric === "lufs" ? spec.target : (prediction?.level ?? -20)) - origLufs)) : 0, t, 0.01);
    L.mon.gain.setTargetAtTime(dbToLin(monitorDb), t, 0.01);
  }, [params, prediction, current, listen, versions, spec, monitorDb]);

  const stopLive = useCallback(() => { const L = live$.current; if (L) { L.srcs.forEach(s => { try { s.stop(); } catch { /* */ } }); L.ctx.close(); live$.current = null; } setPlaying(false); }, []);

  const playLive = async (from = pos) => {
    if (!params || !orig || !buffers[current]) return;
    stopLive();
    const ctx = new AudioContext({ sampleRate: 48000 }); await loadLimiter(ctx);
    const chain = buildChain(ctx, params, prediction?.autoGainDb ?? 0, true);
    const meterIn = ctx.createGain(), mon = ctx.createGain(), wet = ctx.createGain(), og = ctx.createGain();
    chain.output.connect(wet).connect(meterIn); og.connect(meterIn); meterIn.connect(mon).connect(ctx.destination);
    const k1 = ctx.createBiquadFilter(); k1.type = "highshelf"; k1.frequency.value = 1682; k1.gain.value = 4;
    const k2 = ctx.createBiquadFilter(); k2.type = "highpass"; k2.frequency.value = 38; k2.Q.value = -6;
    const kA = ctx.createAnalyser(); kA.fftSize = 4096; const pA = ctx.createAnalyser(); pA.fftSize = 4096;
    meterIn.connect(k1).connect(k2).connect(kA); meterIn.connect(pA);
    const vg: Record<string, GainNode> = {}; const srcs: AudioBufferSourceNode[] = [];
    for (const k of VERSION_KEYS) { const s = ctx.createBufferSource(); s.buffer = buffers[k]; vg[k] = ctx.createGain(); vg[k].gain.value = k === current ? 1 : 0; s.connect(vg[k]).connect(chain.input); srcs.push(s); }
    const so = ctx.createBufferSource(); so.buffer = orig; so.connect(og); srcs.push(so);
    const when = ctx.currentTime + 0.05; srcs.forEach(s => s.start(when, from));
    srcs[0].onended = () => { if (live$.current?.srcs === srcs) { setPlaying(false); } };
    live$.current = { ctx, chain, srcs, vg, og, wet, mon, started: when, offset: from, kA, pA };
    setPlaying(true); setListen(l => l);
    setParams(p => p ? { ...p } : p);
  };

  // Mätare
  useEffect(() => {
    if (!playing) return; let raf = 0; const hist: number[] = []; const buf = new Float32Array(4096);
    const tick = () => {
      const L = live$.current; if (!L) return;
      setPos(Math.min(orig?.duration ?? 0, L.offset + L.ctx.currentTime - L.started));
      L.kA.getFloatTimeDomainData(buf); let e = 0; for (const v of buf) e += v * v; hist.push(e / buf.length); if (hist.length > 180) hist.shift();
      L.pA.getFloatTimeDomainData(buf); let pk = 0; for (const v of buf) pk = Math.max(pk, Math.abs(v));
      const ms = hist.reduce((a, b) => a + b, 0) / hist.length;
      setLive(prev => ({ lufs: -0.691 + 10 * Math.log10(ms + 1e-24) - monitorDb, peak: Math.max(linToDb(pk) - monitorDb, prev.peak - 0.3) }));
      raf = requestAnimationFrame(tick);
    }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [playing, orig, monitorDb]);

  const set = (fn: (p: Params) => Params) => setParams(p => p ? fn(structuredClone(p)) : p);

  const savePreset = async () => { if (!params || !presetName.trim()) return; try { await api("presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: presetName.trim(), spec: specId, params }) }); setPresets((await api<{ presets: Preset[] }>("presets")).presets); } catch (e) { setError((e as Error).message); } };

  const masterFile = async (target: { id: string } | null, f?: File) => {
    if (!params) return; setError(""); setMasterState({ progress: "Laddar upp hela filen…", state: "running" });
    try {
      const id = f ? (await uploadFile(f)).id : target!.id;
      const { job } = await api<{ job: string }>(`${id}/master?spec=${specId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ params }) });
      for (;;) { await new Promise(r => setTimeout(r, 1500)); const s = await api<{ state: string; progress: string; result?: Measure; audio?: string; error?: string }>(`jobs/${job}`); setMasterState(s); if (s.state !== "running") break; }
    } catch (e) { setMasterState({ state: "failed", error: (e as Error).message }); }
  };

  const ok = (v: number | null | undefined, lo: number, hi: number) => v !== null && v !== undefined && v >= lo && v <= hi;
  const levelOk = spec && prediction ? (spec.metric === "lufs" ? ok(prediction.level, spec.target - (spec.tolerance ?? 0.5), spec.target + (spec.tolerance ?? 0.5)) : ok(prediction.level, spec.range![0], spec.range![1])) : false;
  const tpOk = spec && prediction ? prediction.truePeak <= spec.peak_max : false;
  const liveLevelOk = spec ? Math.abs(live.lufs - (spec.metric === "lufs" ? spec.target : -20)) <= 2 : false;

  return <main className="ab-studio st">
    <header className="ab-header"><Wordmark href="/tools/audiobook" /><span className="ab-badge">SALTWAVES STUDIO · V1</span></header>
    <div className="ab-heading"><div><p className="ab-eyebrow">MÄT · LEVERANSFIX · HELA KEDJAN</p><h1>Hör ändringen<span>.</span></h1></div><p>Ladda upp ett utdrag på 30–60 sekunder, justera och spara ett preset. Mastra sedan hela filen med samma inställningar. <a href="/tools/audiobook">← Tillbaka till Audiobook</a></p></div>
    <div className="st-specbar" role="group" aria-label="Leveransspec">{specs.map(s => <button key={s.id} className="ab-secondary" aria-pressed={s.id === specId} onClick={() => setSpecId(s.id)}>{s.label}</button>)}{spec?.note && <small>{spec.note}</small>}</div>

    <section className="ab-workspace">
      <div className="ab-filebar"><div><span className="ab-eyebrow">01 · LJUDFIL</span><h2>{file?.name || "Välj ett utdrag"}</h2></div><button className="ab-secondary" disabled={!!busy} onClick={() => input.current?.click()}>{file ? "Byt fil" : "Välj ljudfil"}</button></div>
      <input ref={input} hidden type="file" accept=".wav,.mp3,.m4a,.aif,.aiff,.flac" onChange={e => { if (e.target.files?.[0]) void choose(e.target.files[0]); e.target.value = ""; }} />
      {!orig ? <div className="ab-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) void choose(e.dataTransfer.files[0]); }}><div className="ab-drop-icon">↑</div><p>Dra din ljudfil hit</p><span>WAV, MP3, M4A, AIFF eller FLAC · 30–60 s räcker för att justera</span></div>
        : <div className="st-player"><Waveform buffer={orig} position={pos} onSeek={t => { setPos(t); if (audioEl.current) audioEl.current.currentTime = t; if (playing) void playLive(t); }} /><audio ref={audioEl} src={origUrl} controls onTimeUpdate={e => { if (!playing) setPos(e.currentTarget.currentTime); }} /></div>}
      <div className="st-actions" aria-label="Bearbetning">
        <button className="ab-secondary" disabled={!file || !!busy} onClick={() => void doMeasure()}><b>1 · Measure</b><span>Loudness, true peak, dynamik och brusgolv mot spec</span></button>
        <button className="ab-secondary" disabled={!file || !!busy} onClick={() => void doDelivery()}><b>2 · Delivery-fix</b><span>Bara nivå, toppar och limiter till spec</span></button>
        <button className="ab-master" disabled={!file || !!busy} onClick={() => void doFull()}><b>3 · Full chain</b><span>Hela bearbetningskedjan, sedan justering</span></button>
      </div>
      {busy && <p className="ab-status" role="status"><span className="ab-spinner" />{busy}</p>}
      {error && <p className="ab-error" role="alert">{error}</p>}
      {measure && <div className="st-panel"><h3>Mätning av originalet {measure.pass ? <em className="st-ok">klarar specen</em> : <em className="st-bad">klarar inte specen</em>}</h3><Checks m={measure} /></div>}
      {delivery && <div className="st-panel"><h3>Leveransfix {delivery.measure.pass ? <em className="st-ok">klarar specen</em> : <em className="st-bad">utanför spec</em>}</h3><audio src={delivery.url} controls /><Checks m={delivery.measure} /><a className="ab-secondary" href={delivery.url} download>Ladda ner WAV</a></div>}
    </section>

    {versions && params && spec && <section className="st-adjust">
      <div className="st-adjust-head"><div><p className="ab-eyebrow">02 · JUSTERA I REALTID</p><h2>Justera kedjan</h2><p>Brusreducering och klickborttagning är färdigrenderade på servern och växlas direkt. EQ, kompressor, de-esser och limiter körs live i webbläsaren med samma parametrar som mastringen.</p></div>
        <div className="st-transport"><button className="ab-play" onClick={() => playing ? stopLive() : void playLive()}>{playing ? "Ⅱ" : "▶"}</button><div className="ab-switch" role="group" aria-label="A/B"><button aria-pressed={listen === "original"} onClick={() => setListen("original")}>A · Original</button><button aria-pressed={listen === "processed"} onClick={() => setListen("processed")}>B · Bearbetat</button></div><small>Nivåmatchat mot målnivån</small></div></div>
      <div className="st-meters">
        <div className={liveLevelOk ? "st-ok" : "st-bad"}><span>Live loudness (≈3 s)</span><b>{f1(live.lufs)} LUFS</b></div>
        <div className={live.peak <= spec.peak_max ? "st-ok" : "st-bad"}><span>Live topp</span><b>{f1(live.peak)} dB</b></div>
        <div className={levelOk ? "st-ok" : "st-bad"}><span>Förväntad master, {spec.metric === "lufs" ? "integrerad" : "RMS"}</span><b>{prediction ? f1(prediction.level) : "…"} {spec.metric === "lufs" ? "LUFS" : "dBFS"}</b></div>
        <div className={tpOk ? "st-ok" : "st-bad"}><span>Förväntad true peak</span><b>{prediction ? f1(prediction.truePeak) : "…"} dBTP</b></div>
      </div>
      <div className="st-toggles">
        <label><input type="checkbox" checked={params.dfn} onChange={e => set(p => ({ ...p, dfn: e.target.checked }))} /> Brusreducering (100 %)</label>
        <label><input type="checkbox" checked={params.declick} onChange={e => set(p => ({ ...p, declick: e.target.checked }))} /> Klickborttagning</label>
        <label><input type="checkbox" checked={params.comp.on} onChange={e => set(p => { p.comp.on = e.target.checked; return p; })} /> Kompressor</label>
        <label><input type="checkbox" checked={params.deess.on} onChange={e => set(p => { p.deess.on = e.target.checked; return p; })} /> De-esser</label>
        <small>Prenorm före brusreducering: {f1(versions[current]?.meta?.prenorm_gain_db)} dB → −23 LUFS</small>
      </div>
      <div className="st-grid">
        <div className="st-box"><h3>EQ</h3><EqCurve p={params} />
          <Slider label="Högpass" value={params.hpf} min={0} max={200} step={5} unit="Hz" onChange={v => set(p => ({ ...p, hpf: v }))} />
          <Slider label="Bas, frekvens" value={params.low.f} min={60} max={400} step={10} unit="Hz" onChange={v => set(p => { p.low.f = v; return p; })} />
          <Slider label="Bas, nivå" value={params.low.g} min={-12} max={12} step={0.5} unit="dB" onChange={v => set(p => { p.low.g = v; return p; })} />
          <Slider label="Mellan, frekvens" value={params.mid.f} min={300} max={6000} step={50} unit="Hz" onChange={v => set(p => { p.mid.f = v; return p; })} />
          <Slider label="Mellan, nivå" value={params.mid.g} min={-12} max={12} step={0.5} unit="dB" onChange={v => set(p => { p.mid.g = v; return p; })} />
          <Slider label="Mellan, Q" value={params.mid.q} min={0.3} max={6} step={0.1} unit="" onChange={v => set(p => { p.mid.q = v; return p; })} />
          <Slider label="Diskant, frekvens" value={params.high.f} min={3000} max={14000} step={100} unit="Hz" onChange={v => set(p => { p.high.f = v; return p; })} />
          <Slider label="Diskant, nivå" value={params.high.g} min={-12} max={12} step={0.5} unit="dB" onChange={v => set(p => { p.high.g = v; return p; })} />
        </div>
        <div className="st-box"><h3>Kompressor</h3>
          <Slider label="Tröskel" value={params.comp.threshold} min={-50} max={0} step={1} unit="dB" onChange={v => set(p => { p.comp.threshold = v; return p; })} />
          <Slider label="Ratio" value={params.comp.ratio} min={1} max={10} step={0.5} unit=":1" onChange={v => set(p => { p.comp.ratio = v; return p; })} />
          <Slider label="Attack" value={params.comp.attack} min={1} max={100} step={1} unit="ms" onChange={v => set(p => { p.comp.attack = v; return p; })} />
          <Slider label="Release" value={params.comp.release} min={20} max={1000} step={10} unit="ms" onChange={v => set(p => { p.comp.release = v; return p; })} />
          <Slider label="Knä" value={params.comp.knee} min={1} max={8} step={0.5} unit="dB" onChange={v => set(p => { p.comp.knee = v; return p; })} />
          <h3>De-esser</h3>
          <Slider label="Frekvens" value={params.deess.freq} min={3000} max={10000} step={100} unit="Hz" onChange={v => set(p => { p.deess.freq = v; return p; })} />
          <Slider label="Tröskel" value={params.deess.threshold} min={-60} max={0} step={1} unit="dB" onChange={v => set(p => { p.deess.threshold = v; return p; })} />
          <Slider label="Ratio" value={params.deess.ratio} min={1} max={10} step={0.5} unit=":1" onChange={v => set(p => { p.deess.ratio = v; return p; })} />
        </div>
        <div className="st-box"><h3>Limiter och nivå</h3>
          <Slider label="Limitertak" value={params.limiter.ceiling} min={-6} max={-3.3} step={0.1} unit="dB" onChange={v => set(p => { p.limiter.ceiling = v; return p; })} />
          <p className="st-note">Nivån sätts automatiskt till {spec.label} ({spec.metric === "lufs" ? `${f1(spec.target)} LUFS` : "RMS −20 dBFS"}). Just nu {prediction ? `${prediction.autoGainDb >= 0 ? "+" : ""}${f1(prediction.autoGainDb)} dB` : "…"}.</p>
          <Slider label="Lyssningsvolym" value={monitorDb} min={-20} max={6} step={0.5} unit="dB" onChange={setMonitorDb} />
          <p className="st-note">Lyssningsvolymen påverkar bara uppspelningen här, inte mastern.</p>
          <h3>Presets</h3>
          <div className="st-preset"><input placeholder="Namn, t.ex. inläsare eller bok" value={presetName} onChange={e => setPresetName(e.target.value)} /><button className="ab-secondary" disabled={!presetName.trim()} onClick={() => void savePreset()}>Spara</button></div>
          <ul className="st-presets">{presets.map(p => <li key={p.name}><button className="ab-secondary" onClick={() => { setParams(p.params); setSpecId(p.spec); setPresetName(p.name); }}>{p.name}</button></li>)}</ul>
        </div>
      </div>
      <div className="st-panel"><p className="ab-eyebrow">03 · MASTRA HELA FILEN</p><p>Samma inställningar körs på servern: klickborttagning, normalisering till −23 LUFS, brusreducering, EQ, kompressor, de-esser, nivå till spec och limiter. Exporten blir 44,1 kHz, 16 bit mono med dither.</p>
        <div className="st-row"><button className="ab-master" disabled={masterState?.state === "running"} onClick={() => fullInput.current?.click()}>Välj hela filen och mastra</button><button className="ab-secondary" disabled={masterState?.state === "running"} onClick={() => void masterFile(file)}>Mastra det här utdraget</button></div>
        <input ref={fullInput} hidden type="file" accept=".wav,.mp3,.m4a,.aif,.aiff,.flac" onChange={e => { if (e.target.files?.[0]) void masterFile(null, e.target.files[0]); e.target.value = ""; }} />
        {masterState?.state === "running" && <p className="ab-status"><span className="ab-spinner" />{masterState.progress}</p>}
        {masterState?.state === "failed" && <p className="ab-error">{masterState.error}</p>}
        {masterState?.state === "done" && masterState.result && <><h3>Master {masterState.result.pass ? <em className="st-ok">klarar specen</em> : <em className="st-bad">utanför spec</em>}</h3><Checks m={masterState.result} /><a className="ab-master" href={`${API}/${masterState.audio}`} download>Ladda ner master</a></>}
      </div>
    </section>}
    <footer className="ab-footer"><span>SALTWAVES STUDIO</span><span>En fil. En enhetlig behandling.</span></footer>
  </main>;
}
