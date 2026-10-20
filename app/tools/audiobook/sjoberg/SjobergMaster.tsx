"use client";
// Sjöberg förlag: EarSelect-sidans flöde (provmastra utdrag → lyssna/jämför → mastra hela kapitlet) utan reglage.
// Fast spec "Audiobook Nordic" och den låsta kedjan med pausexpander; allt ljud laddas upp med tus till lagringen.
import { useEffect, useRef, useState } from "react";
import { SjNav, Wordmark } from "./portal/ui";
import { wavOverview, type Overview } from "@/lib/audiobook-wave";
import { sjobergTusUpload } from "@/lib/sjoberg-upload";
import "../audiobook.css";
import "./sjoberg.css";

const API = "/api/audiobook-sjoberg";
const MAX = 1000 * 1024 * 1024;
type Slot = "before" | "after";
type Track = Overview & { url: string };
type Mode = "preview" | "master";
type Check = { id: string; label: string; value: number | string | null; unit?: string; requirement: string; pass: boolean };
type Measure = { pass: boolean; checks: Check[] };
type Done = { mode: Mode; start: number; before: Track; after: Track; master: Measure; original: Measure | null; blob: Blob; upload: string; job: string; duration: number };
type BookRef = { id: string; title: string; narrator: string };
type Saved = { book: string; title: string; number: number; name: string };
const PORTAL = "/api/sjoberg-portal";
// Samma tolkning av kapitelnummer som portalen (servern gör samma sak om fältet lämnas tomt).
function guessChapter(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const kap = stem.match(/(?:kap(?:itel)?|chapter|ch)[\s._#-]*(\d{1,4})/i), nums = [...stem.matchAll(/\d{1,4}/g)];
  const hit = kap ? { n: Number(kap[1]), at: kap.index!, len: kap[0].length } : nums.length ? { n: Number(nums[nums.length - 1][0]), at: nums[nums.length - 1].index!, len: nums[nums.length - 1][0].length } : null;
  let name = hit ? stem.slice(0, hit.at) + " " + stem.slice(hit.at + hit.len) : stem;
  name = name.replace(/[_#]+/g, " ").replace(/\s*[-–.]\s*$/g, "").replace(/^\s*[-–.]\s*/g, "").replace(/\s+/g, " ").trim();
  return { number: hit ? String(hit.n) : "", name: name || (hit ? `Kapitel ${hit.n}` : "") };
}
const fmt = (s: number) => { const n = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0)); return `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; };
const sv = (t: string) => t.replace(/(\d)\.(\d)/g, "$1,$2").replace(/-(?=\d)/g, "−");
const val = (c?: Check) => !c ? "—" : typeof c.value === "number" ? `${sv(c.value.toFixed(1))} ${c.unit ?? ""}`.trim() : sv(String(c.value ?? "—"));

type Wav = { code: number; channels: number; rate: number; bits: number; align: number; dataOffset: number; dataSize: number };
async function parseWav(file: Blob): Promise<Wav | null> {
  const h = new DataView(await file.slice(0, 1024 * 1024).arrayBuffer());
  const tag = (o: number) => String.fromCharCode(...Array.from({ length: 4 }, (_, i) => h.getUint8(o + i)));
  if (h.byteLength < 44 || !["RIFF", "RF64"].includes(tag(0)) || tag(8) !== "WAVE") return null;
  let o = 12, w: Partial<Wav> = {}, rf = 0;
  while (o + 8 <= h.byteLength) {
    const k = tag(o), size = h.getUint32(o + 4, true), p = o + 8;
    if (k === "ds64" && p + 24 <= h.byteLength) rf = Number(h.getBigUint64(p + 8, true));
    if (k === "fmt ") { let code = h.getUint16(p, true); if (code === 65534 && size >= 40) code = h.getUint16(p + 24, true); w = { ...w, code, channels: h.getUint16(p + 2, true), rate: h.getUint32(p + 4, true), align: h.getUint16(p + 12, true), bits: h.getUint16(p + 14, true) }; }
    if (k === "data") { w.dataOffset = p; w.dataSize = size === 0xffffffff ? rf : Math.min(size, file.size - p); break; }
    o = p + size + (size % 2);
  }
  return w.dataOffset && w.align && w.rate && (w.code === 1 || w.code === 3) ? w as Wav : null;
}
function wavHeader(code: number, channels: number, rate: number, bits: number, bytes: number) {
  const b = new DataView(new ArrayBuffer(44)), s = (o: number, t: string) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  s(0, "RIFF"); b.setUint32(4, 36 + bytes, true); s(8, "WAVE"); s(12, "fmt "); b.setUint32(16, 16, true); b.setUint16(20, code, true); b.setUint16(22, channels, true);
  b.setUint32(24, rate, true); b.setUint32(28, rate * channels * bits / 8, true); b.setUint16(32, channels * bits / 8, true); b.setUint16(34, bits, true); s(36, "data"); b.setUint32(40, bytes, true);
  return b.buffer;
}
// Utdraget klipps i webbläsaren: WAV byte-exakt (inga omkodningar), övriga format avkodas och skrivs som 32-bit float WAV.
async function cut(file: File, start: number, length: number): Promise<Blob> {
  const w = await parseWav(file);
  if (w) {
    const first = Math.floor(start * w.rate), frames = Math.min(Math.floor(length * w.rate), Math.floor(w.dataSize / w.align) - first);
    return new Blob([wavHeader(w.code, w.channels, w.rate, w.bits, frames * w.align), file.slice(w.dataOffset + first * w.align, w.dataOffset + (first + frames) * w.align)], { type: "audio/wav" });
  }
  const buf = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(await file.arrayBuffer());
  const a = Math.floor(start * buf.sampleRate), n = Math.min(Math.floor(length * buf.sampleRate), buf.length - a), ch = buf.numberOfChannels;
  const out = new Float32Array(n * ch);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i * ch + c] = d[a + i]; }
  return new Blob([wavHeader(3, ch, buf.sampleRate, 32, out.byteLength), out.buffer], { type: "audio/wav" });
}
async function overviewOf(blob: Blob): Promise<Track> {
  const o = await wavOverview(blob); const url = URL.createObjectURL(blob);
  if (o) return { ...o, url };
  const buf = await new OfflineAudioContext(1, 1, 8000).decodeAudioData(await blob.arrayBuffer());
  const s = buf.getChannelData(0); let e = 0;
  const peaks = Array.from({ length: 2000 }, (_, i) => { let p = 0; for (let k = Math.floor(i * s.length / 2000); k < Math.floor((i + 1) * s.length / 2000); k++) { p = Math.max(p, Math.abs(s[k])); e += s[k] * s[k]; } return p; });
  return { url, duration: buf.duration, peaks, rms: Math.sqrt(e / s.length) };
}
async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}/${path}`, init); const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Något gick fel. Försök igen."); return d as T;
}

function Wave({ item, current, title, onSeek, selection }: { item: Overview | null; current: number; title: string; onSeek: (t: number) => void; selection?: { start: number; length: number; disabled: boolean; change: (t: number) => void } }) {
  const box = useRef<HTMLDivElement>(null), drag = useRef<{ x: number; start: number } | null>(null);
  const duration = item?.duration || 1, scale = Math.max(.01, ...(item?.peaks || []));
  return <div className="ab-wave is-active"><div className="ab-wave-label"><span>{title}</span><span>{item ? fmt(item.duration) : "Väntar på resultat"}</span></div><div className="ab-wave-body" ref={box}>
    {item ? <><svg viewBox="0 0 2000 100" preserveAspectRatio="none" aria-hidden="true">{item.peaks.map((p, i) => <line key={i} x1={i * 2000 / item.peaks.length} x2={i * 2000 / item.peaks.length} y1={50 - p / scale * 44} y2={50 + p / scale * 44} stroke="currentColor" strokeWidth="1" />)}</svg>
      <input aria-label={`Spelposition ${title}`} type="range" min={0} max={duration} step={.1} value={Math.min(current, duration)} onChange={e => onSeek(Number(e.target.value))} /><div className="ab-playhead" style={{ left: `${Math.min(100, current / duration * 100)}%` }} />
      {selection && <div className="ab-selection" role="slider" aria-label="Välj ett utdrag" aria-valuemin={0} aria-valuemax={Math.max(0, duration - selection.length)} aria-valuenow={selection.start} aria-valuetext={`${fmt(selection.start)} till ${fmt(Math.min(duration, selection.start + selection.length))}`} aria-disabled={selection.disabled} tabIndex={selection.disabled ? -1 : 0} style={{ left: `${selection.start / duration * 100}%`, width: `${Math.min(selection.length, duration) / duration * 100}%` }}
        onPointerDown={e => { if (selection.disabled) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, start: selection.start }; }}
        onPointerMove={e => { if (!drag.current || !box.current) return; selection.change(drag.current.start + (e.clientX - drag.current.x) / box.current.clientWidth * duration); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onKeyDown={e => { if (selection.disabled) return; const m = e.shiftKey ? 60 : 10; if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); selection.change(selection.start + (e.key === "ArrowLeft" ? -m : m)); } }}><span>↔</span></div>}
    </> : <div className="ab-wave-empty">Välj en ljudfil för att börja</div>}
  </div></div>;
}

export default function SjobergMaster() {
  const [file, setFile] = useState<File | null>(null), [source, setSource] = useState<Track | null>(null), [name, setName] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "uploading" | "running" | "done">("idle"), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null), [stem, setStem] = useState("");
  const [start, setStart] = useState(0), [length, setLength] = useState(300), [whole, setWhole] = useState(true), [matched, setMatched] = useState(true);
  const [slot, setSlot] = useState<Slot>("before"), [playing, setPlaying] = useState(false), [current, setCurrent] = useState(0);
  const a = useRef<HTMLAudioElement>(null), b = useRef<HTMLAudioElement>(null), input = useRef<HTMLInputElement>(null), ctx = useRef<AudioContext | null>(null), gains = useRef<GainNode[]>([]), active = useRef<Slot>("before"), urls = useRef<string[]>([]), pendingSeek = useRef<number | null>(null);
  const [books, setBooks] = useState<BookRef[]>([]), [bookSel, setBookSel] = useState(""), [newTitle, setNewTitle] = useState(""), [newNarrator, setNewNarrator] = useState("");
  const [chNum, setChNum] = useState(""), [chName, setChName] = useState(""), [taken, setTaken] = useState<number[]>([]), [saved, setSaved] = useState<Saved | null>(null), [saving, setSaving] = useState(false);
  async function loadBooks() { const r = await fetch(`${PORTAL}/books`).catch(() => null); const d = r?.ok ? await r.json().catch(() => null) : null; if (d?.books) setBooks(d.books); }
  useEffect(() => { void loadBooks(); }, []);
  useEffect(() => { setTaken([]); if (!bookSel || bookSel === "new") return; void fetch(`${PORTAL}/books/${bookSel}`).then(r => r.ok ? r.json() : null).then(d => setTaken((d?.chapters || []).map((c: { number: number }) => c.number))).catch(() => {}); }, [bookSel, saved]);
  const metaOk = (bookSel === "new" ? !!newTitle.trim() : !!bookSel) && (chNum === "" || (/^\d{1,4}$/.test(chNum.trim()))) && !!chName.trim();
  const dupe = chNum !== "" && taken.includes(Number(chNum));
  const busy = ["loading", "uploading", "running"].includes(phase) || saving;
  const before = whole ? source : done?.before, after = whole ? null : done?.after;
  const synced = !!before && !!after && Math.abs(before.duration - after.duration) < .2;
  const offset = done?.mode === "preview" ? done.start : 0;
  const stale = done?.mode === "preview" && (Math.abs(done.start - start) > .05 || Math.abs(done.before.duration - Math.min(length, (source?.duration || 0) - start)) > .5);

  function stop(reset = false) { a.current?.pause(); b.current?.pause(); setPlaying(false); if (reset) seek(0); }
  function seek(t: number) { for (const el of [a.current, b.current]) if (el?.src && Number.isFinite(el.duration)) el.currentTime = Math.min(t, el.duration); setCurrent(t); }
  function move(v: number) { setStart(Math.round(Math.max(0, Math.min(v, Math.max(0, (source?.duration || 0) - length))) * 10) / 10); }
  function mix(next: Slot, matching = matched) {
    active.current = next; setSlot(next); const c = ctx.current;
    gains.current.forEach((g, i) => { if (!c) return; const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t);
      const ratio = matching && before && after ? Math.min(1, i === 0 ? after.rms / before.rms : before.rms / after.rms) : 1;
      g.gain.linearRampToValueAtTime(i === (next === "before" ? 0 : 1) ? (Number.isFinite(ratio) ? ratio : 1) : 0, t + .02); });
  }
  async function play() {
    if (playing) { stop(); return; }
    try {
      if (!ctx.current) { const c = new AudioContext(); ctx.current = c; gains.current = [a.current!, b.current!].map(el => { const g = c.createGain(); c.createMediaElementSource(el).connect(g).connect(c.destination); return g; }); }
      await ctx.current.resume(); mix(active.current);
      if (synced && a.current && b.current) { b.current.currentTime = a.current.currentTime; await Promise.all([a.current.play(), b.current.play()]); } else await a.current?.play();
      setPlaying(true); setError("");
    } catch { stop(); setError("Ljudet kunde inte spelas. Tryck på Play igen."); }
  }
  function listenWhole(t = 0) { stop(); mix("before"); if (whole) seek(t); else { pendingSeek.current = t; setWhole(true); setCurrent(t); } }
  function listenComparison() { stop(); mix("before"); pendingSeek.current = 0; setWhole(false); setCurrent(0); }

  async function choose(next: File) {
    if (busy) return; stop(true); setError(""); setDone(null); setSource(null); setFile(null); setName(next.name); setSaved(null); { const g = guessChapter(next.name); setChNum(g.number); setChName(g.name); } setStart(0); setWhole(true); mix("before");
    urls.current.forEach(URL.revokeObjectURL); urls.current = [];
    if (!/\.(wav|mp3|m4a|aif|aiff|flac)$/i.test(next.name) || next.size > MAX) { setPhase("idle"); setError("Välj WAV, MP3, M4A, AIFF eller FLAC, högst 1 000 MB. Dela längre böcker i kapitel."); return; }
    if (!/\.wav$/i.test(next.name) && next.size > 200 * 1024 * 1024) { setPhase("idle"); setError("MP3, M4A, AIFF och FLAC kan vara högst 200 MB. Använd WAV för större filer."); return; }
    setPhase("loading"); setMessage("Läser in vågformen…");
    try { const t = await overviewOf(next); urls.current.push(t.url); setSource(t); setFile(next); setStem(next.name.replace(/\.[^.]+$/, "") + "_master"); setPhase("ready"); }
    catch { setPhase("idle"); setError("Filen kunde inte läsas."); }
  }

  async function archive(d: Done) {
    if (!metaOk) { setError("Välj bok och ange kapitlets namn först."); return; }
    setSaving(true); setError(""); setMessage("Sparar i arkivet…");
    try {
      let book = bookSel, title = books.find(x => x.id === bookSel)?.title || "";
      if (book === "new") {
        const r = await fetch(`${PORTAL}/books`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: newTitle.trim(), narrator: newNarrator.trim() }) });
        const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(x.error || "Boken kunde inte skapas.");
        book = x.id; title = newTitle.trim(); setBookSel(book); setNewTitle(""); setNewNarrator(""); await loadBooks();
      }
      const r = await fetch(`${PORTAL}/books/${book}/archive`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ upload: d.upload, job: d.job, filename: name, number: chNum.trim(), name: chName.trim(), duration: d.duration }) });
      const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(x.error || "Kapitlet kunde inte sparas i arkivet.");
      setSaved({ book, title, number: x.number, name: x.name });
    } catch (e) { setError(e instanceof Error && e.message ? e.message : "Kapitlet kunde inte sparas i arkivet."); }
    finally { setSaving(false); setMessage(""); }
  }
  async function run(mode: Mode, save = false) {
    if (busy || !file || !source) return;
    stop(); mix("before"); setError(""); setPhase("uploading");
    try {
      const at = mode === "preview" ? start : 0;
      const blob = mode === "preview" ? await cut(file, at, length) : file;
      const up = blob instanceof File ? blob : new File([blob], file.name.replace(/\.[^.]+$/, "") + "_utdrag.wav", { type: "audio/wav", lastModified: file.lastModified });
      const began = performance.now();
      const ing = await sjobergTusUpload(up, API, (sent, total) => { const s = (performance.now() - began) / 1000, speed = s > 1 ? sent / s : 0; setMessage(`Laddar upp ${Math.floor(sent / total * 100)} % · ${(sent / 1024 ** 2).toFixed(0)} av ${(total / 1024 ** 2).toFixed(0)} MB${speed > 0 ? ` · ${(speed / 1024 ** 2).toFixed(1)} MB/s` : ""}`); });
      setPhase("running"); setMessage(mode === "preview" ? "Mastrar utdraget…" : "Mastrar hela kapitlet…");
      const [{ job }, original] = await Promise.all([j<{ job: string }>(`${ing.id}/master`, { method: "POST" }), j<Measure | null>(`${ing.id}/measure`, { method: "POST" }).catch(() => null)]);
      const t0 = Date.now(); let master: Measure | null = null;
      for (;;) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await j<{ state: string; result?: Measure; error?: string }>(`jobs/${job}`).catch(() => ({ state: "running" } as { state: string; result?: Measure; error?: string }));
        if (s.state === "done") { master = s.result ?? null; break; }
        if (s.state === "failed") throw new Error(s.error);
        const sec = Math.round((Date.now() - t0) / 1000); setMessage(`${mode === "preview" ? "Mastrar utdraget" : "Mastrar hela kapitlet"}… ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);
      }
      setMessage("Hämtar mastern…");
      const out = await (await fetch(`${API}/${ing.id}/audio/master`)).blob();
      const beforeTrack = mode === "preview" ? await overviewOf(up) : source, afterTrack = await overviewOf(out);
      urls.current.push(afterTrack.url); if (mode === "preview") urls.current.push(beforeTrack.url);
      const result: Done = { mode, start: at, before: beforeTrack, after: afterTrack, master: master!, original, blob: out, upload: ing.id, job, duration: ing.duration };
      setDone(result); if (mode === "master") setSaved(null);
      setStem(file.name.replace(/\.[^.]+$/, "") + (mode === "preview" ? "_provmaster" : "_master"));
      setPhase("done"); setMessage(""); setWhole(false); setCurrent(0); pendingSeek.current = 0;
      if (save) await archive(result);
    } catch (e) { setPhase("ready"); setError(e instanceof Error && e.message ? e.message : "Körningen kunde inte slutföras. Försök igen."); }
  }
  useEffect(() => { if (!playing) return; let f: number; const tick = () => { const lead = active.current === "before" ? a.current : b.current; if (lead) setCurrent(lead.currentTime); if (synced && a.current && b.current && !a.current.seeking && !b.current.seeking && Math.abs(a.current.currentTime - b.current.currentTime) > .04) b.current.currentTime = a.current.currentTime; f = requestAnimationFrame(tick); }; f = requestAnimationFrame(tick); return () => cancelAnimationFrame(f); }, [playing, synced]);
  useEffect(() => () => { urls.current.forEach(URL.revokeObjectURL); void ctx.current?.close(); }, []);
  function download() {
    if (!done) return; const n = stem.trim().replace(/[\\/:*?"<>|]/g, "").slice(0, 236);
    if (!n) { setError("Ange ett filnamn."); return; }
    const l = document.createElement("a"); l.href = done.after.url; l.download = `${n}.wav`; l.click();
  }
  const rows = done ? done.master.checks.map(c => ({ c, o: done.original?.checks.find(x => x.id === c.id) })) : [];
  const failed = rows.filter(r => !r.c.pass);

  return <main className="ab-studio" lang="sv">
    <header className="ab-header"><Wordmark href="/tools/audiobook/sjoberg/portal" /><span className="ab-badge">SJÖBERG FÖRLAG · AUDIOBOOK</span></header>
    <SjNav active="prov" />
    <div className="ab-heading"><div><p className="ab-eyebrow">PROVLYSSNA · JÄMFÖR · MASTRA</p><h1>Audiobook<span>.</span></h1></div><p>Lyssna på originalet, provmastra ett utdrag och jämför före och efter. När du är nöjd mastrar du hela kapitlet och sparar det i bokens arkiv.</p></div>
    <ol className="ab-steps" aria-label="Så fungerar det"><li><span>1</span><div><strong>Ladda upp och lyssna</strong><p>Välj din fil och lyssna på originalet.</p></div></li><li><span>2</span><div><strong>Provmastra ett utdrag</strong><p>Välj ett avsnitt och hör resultatet.</p></div></li><li><span>3</span><div><strong>Mastra hela kapitlet</strong><p>Spara i arkivet och ladda ner den färdiga mastern.</p></div></li></ol>
    <section className="ab-workspace" aria-label="Ljudbok och provfönster"><div className="ab-filebar"><div><span className="ab-eyebrow">01 · LADDA UPP OCH LYSSNA</span><h2>{name || "Välj din ljudfil"}</h2></div><button className="ab-secondary" disabled={busy} onClick={() => input.current?.click()}>{name ? "Byt fil" : "Välj ljudfil"}</button></div>
      <input ref={input} hidden type="file" accept=".wav,.mp3,.m4a,.aif,.aiff,.flac" onChange={e => { if (e.target.files?.[0]) void choose(e.target.files[0]); e.target.value = ""; }} />
      {!source ? <div className="ab-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) void choose(e.dataTransfer.files[0]); }}><div className="ab-drop-icon">↑</div><p>{phase === "loading" ? "Läser in vågformen…" : "Dra din ljudfil hit"}</p><span>WAV · högst 1 000 MB · mono eller stereo<br />MP3, M4A, AIFF och FLAC upp till 200 MB<br />Dela längre böcker i kapitel.</span></div> : <>
        <Wave item={source} current={whole ? current : current + offset} title="Hela originalet · vågformsöversikt" onSeek={t => listenWhole(t)} selection={{ start, length, disabled: busy, change: move }} />
        <div className="ab-timeline"><span>0:00:00</span><span>{fmt(source.duration / 2)}</span><span>{fmt(source.duration)}</span></div>
        <div className="ab-preview-controls"><div><strong>Välj ett utdrag</strong><p>Dra det orange fönstret till det du vill höra, eller ange starttiden.</p></div>
          <label>Starttid <input key={start} aria-label="Utdragets starttid" type="text" inputMode="numeric" placeholder="0:00:00" disabled={busy} defaultValue={fmt(start)} onBlur={e => { const p = e.target.value.trim().split(":").map(Number); if (p.length === 3 && p.every(Number.isFinite) && p[1] < 60 && p[2] < 60 && p.every(x => x >= 0)) { move(p[0] * 3600 + p[1] * 60 + p[2]); setError(""); } else { e.target.value = fmt(start); setError("Ange starttiden som timmar:minuter:sekunder, till exempel 0:12:00."); } }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /><span>timmar:minuter:sekunder</span></label>
          <label>Längd <select aria-label="Utdragets längd" disabled={busy} value={length} onChange={e => { const v = Number(e.target.value); setLength(v); setStart(Math.min(start, Math.max(0, source.duration - v))); }}><option value={300}>5 minuter</option><option value={600}>10 minuter</option></select></label>
          <p className="ab-selection-time">Valt: {fmt(start)}–{fmt(Math.min(source.duration, start + length))}</p></div>
      </>}
      {done && <div className="ab-listen-tabs"><button className="ab-secondary" aria-pressed={whole} onClick={() => listenWhole()}>Hela originalet</button><button className="ab-secondary" aria-pressed={!whole} onClick={listenComparison}>{done.mode === "preview" ? `Provmastrat utdrag ${fmt(offset)}–${fmt(offset + done.before.duration)}` : "Före / efter hela kapitlet"}</button></div>}
      {!whole && done && <><Wave item={done.before} current={current} title="Före · Original" onSeek={seek} /><Wave item={done.after} current={current} title="Efter · Master" onSeek={seek} /></>}
      <div className="ab-transport"><div className="ab-buttons"><button className="ab-play" aria-label={playing ? "Pausa" : "Spela"} disabled={!before?.url} onClick={() => void play()}>{playing ? "Ⅱ" : "▶"}</button><button className="ab-stop" aria-label="Stoppa och gå till början" disabled={!before?.url} onClick={() => stop(true)}>■</button><span className="ab-time">{fmt(current)} <span>/ {fmt(before?.duration || 0)}</span></span></div><div className="ab-switch" role="group" aria-label="Jämför före och efter"><button aria-pressed={slot === "before"} onClick={() => mix("before")}>Före</button><button disabled={!synced} aria-pressed={slot === "after"} onClick={() => mix("after")}>Efter</button></div></div>
      {!synced && <p className="ab-after-help" role="status">{!name ? "Börja med att välja en ljudfil i steg 1." : done && whole ? "Välj jämförelsen ovan för att lyssna på före och efter." : busy ? "Efter blir tillgängligt när mastringen är klar." : "Du lyssnar på originalet. Provmastra ett utdrag i steg 2 för att kunna lyssna på Efter."}</p>}
      {synced && <label className="ab-match"><input type="checkbox" checked={matched} onChange={e => { setMatched(e.target.checked); mix(slot, e.target.checked); }} />Nivåmatcha lyssningen. Ungefärlig jämförelsenivå; påverkar inte mastern.</label>}
      <audio ref={a} src={before?.url} preload="metadata" onLoadedMetadata={() => { if (pendingSeek.current !== null && a.current) { a.current.currentTime = Math.min(pendingSeek.current, a.current.duration); pendingSeek.current = null; } }} onEnded={() => stop(true)} /><audio ref={b} src={after?.url} preload="metadata" onEnded={() => stop(true)} />
    </section>
    {source && <section className="ab-workspace sj-meta" aria-label="Bok och kapitel"><div className="ab-filebar"><div><span className="ab-eyebrow">BOK OCH KAPITEL</span><h2>Var ska kapitlet sparas?</h2></div></div>
      <div className="sj-meta-grid">
        <label>Bok<select value={bookSel} disabled={busy} onChange={e => { setBookSel(e.target.value); setSaved(null); }}><option value="">Välj bok…</option>{books.map(x => <option key={x.id} value={x.id}>{x.title}{x.narrator ? ` · ${x.narrator}` : ""}</option>)}<option value="new">+ Ny bok…</option></select></label>
        {bookSel === "new" && <><label>Bokens titel<input maxLength={200} value={newTitle} disabled={busy} onChange={e => setNewTitle(e.target.value)} placeholder="Titel" /></label><label>Inläsare<input maxLength={200} value={newNarrator} disabled={busy} onChange={e => setNewNarrator(e.target.value)} placeholder="Namn" /></label></>}
        <label>Kapitelnummer<input inputMode="numeric" maxLength={4} value={chNum} disabled={busy} onChange={e => setChNum(e.target.value.replace(/\D/g, ""))} placeholder="Nästa lediga" /></label>
        <label>Kapitelnamn<input maxLength={200} value={chName} disabled={busy} onChange={e => setChName(e.target.value)} placeholder="Till exempel Kapitel 3" /></label>
      </div>
      {dupe && <p className="ab-info">Kapitel {chNum} finns redan i boken. Båda sparas, och du kan ändra numret i portalen.</p>}
      <p className="sj-small">Du kan provmastra utan att välja bok. Bok och kapitel behövs först när du sparar i arkivet.</p>
    </section>}
    <section className="ab-master-panel sj-spec"><div><p className="ab-eyebrow">02 · LEVERANSSPEC</p><h2>Audiobook Nordic</h2><p>Alla filer mastras automatiskt mot samma fasta spec. Det finns inget att ställa in.</p></div>
      <dl className="sj-specgrid"><div><dt>Ljudnivå</dt><dd>−17,5 LUFS ±0,5</dd></div><div><dt>True peak</dt><dd>≤ −3,0 dBTP</dd></div><div><dt>Brusgolv</dt><dd>≤ −80 dBFS</dd></div><div><dt>Format</dt><dd>44,1 kHz / 16 bit mono</dd></div></dl></section>
    <section className="ab-actions" aria-label="Bearbetning"><button className="ab-master" disabled={!file || busy} onClick={() => void run("preview")}>Provmastra utdraget <span>↗</span></button><button className="ab-master" disabled={!file || busy || !metaOk} onClick={() => void run("master", true)}>Mastra hela kapitlet och spara i arkivet <span>→</span></button><button className="ab-secondary" disabled={!file || busy} onClick={() => void run("master")}>Mastra utan att spara</button><p>Provmastra ett utdrag på 5 eller 10 minuter och lyssna innan du mastrar hela kapitlet. Slutmastern kan skilja sig något från utdraget eftersom hela filens nivå bedöms.</p></section>
    <div role="status" aria-live="polite" className="ab-status">{busy && <><span className="ab-spinner" />{message}</>}</div>
    {error && <p role="alert" className="ab-error">{error}</p>}
    {stale && <p className="ab-info">Utdraget har flyttats. Resultatet nedan gäller fortfarande {fmt(done!.start)}–{fmt(done!.start + done!.before.duration)}. Provmastra igen för ett nytt resultat.</p>}
    {!done && <section className="ab-next-step"><p className="ab-eyebrow">03 · JÄMFÖR OCH LADDA NER</p><h2>Här visas ditt resultat.</h2><p>När mastringen är klar kan du lyssna på före och efter, se mätvärdena och ladda ner ljudfilen.</p></section>}
    {done && <section className="ab-result"><div><p className="ab-eyebrow">03 · {done.mode === "preview" ? "DITT PROVMASTRADE UTDRAG ÄR KLART" : "DIN MASTER ÄR KLAR"}</p><h2>Lyssna på skillnaden.</h2><p>{done.mode === "preview" ? `${fmt(done.start)}–${fmt(done.start + done.before.duration)} · Audiobook Nordic. Mätvärdena gäller endast detta utdrag.` : "Hela kapitlet · Audiobook Nordic."}</p></div>
      <p className={failed.length ? "ab-error" : "ab-info"}>{failed.length ? `Utanför målkraven: ${failed.map(r => r.c.label).join(", ")}. Lyssna och kontakta Saltwaves innan leverans.` : "De uppmätta målkraven klaras. Gör också en lyssningskontroll före leverans."}</p>
      <div className="ab-report-table"><table><thead><tr><th>Parameter</th><th>Före</th><th>Efter</th><th>Krav</th><th>Utfall</th></tr></thead><tbody>{rows.map(({ c, o }) => <tr key={c.id}><td>{c.label}</td><td>{val(o)}</td><td>{val(c)}</td><td>{sv(c.requirement)}</td><td className={c.pass ? "" : "ab-fail"}>{c.pass ? "OK" : "Avvikelse"}</td></tr>)}</tbody></table></div>
      <label className="ab-filename">Filnamn för nedladdning<div><input aria-label="Filnamn för nedladdning" value={stem} maxLength={236} onChange={e => setStem(e.target.value)} spellCheck={false} /><span>.wav</span></div><small>Originalets namn är förifyllt. Du kan ändra det här.</small></label>
      <div className="ab-downloads"><button className="ab-master" onClick={download}>{done.mode === "preview" ? "Ladda ner provmastrat utdrag" : "Ladda ner master"}<span>↓</span></button>{done.mode === "preview" && <button className="ab-secondary" disabled={busy || !metaOk} onClick={() => void run("master", true)}>Nöjd? Mastra hela kapitlet och spara i arkivet</button>}{done.mode === "master" && !saved && <button className="ab-secondary" disabled={busy || !metaOk} onClick={() => void archive(done)}>Spara i arkivet</button>}</div>
      {done.mode === "master" && !saved && !metaOk && <p className="sj-small">Välj bok och kapitel ovan för att spara mastern i arkivet.</p>}
      {saved && <p className="ab-info">Sparat i arkivet: kapitel {saved.number} – {saved.name} i ”{saved.title}”. Mätningen visas i boken när mastern har lagrats. <a href={`/tools/audiobook/sjoberg/portal/${saved.book}`}>Öppna boken →</a></p>}
    </section>}
    <p className="ab-retention">Uppladdade filer tas bort från lagringen när de har lästs in. Kapitel som sparas i arkivet finns kvar i 30 dagar efter leverans (första nedladdningen av boken). Provmastringar och mastrar som inte sparas finns bara här, så ladda ner det du vill behålla.</p>
    <footer className="ab-footer"><span>SALTWAVES STUDIO</span><span>En fil. En enhetlig behandling.</span></footer>
  </main>;
}
