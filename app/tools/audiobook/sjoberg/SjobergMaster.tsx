"use client";
// Sjöberg förlag: en knapp, ingen justering. Hela den låsta kedjan med Storytel-spec och pausexpander (variant B).
import { useRef, useState } from "react";
import { Wordmark } from "../../../components/saltwaves-ui";
import { studioTusUpload } from "@/lib/studio-upload";
import "../audiobook.css";
import "../studio/studio.css";
import "./sjoberg.css";

const API = "/api/audiobook-studio";
// Fast mikrofonprofil: kondensator (ingen extra 3,1 kHz-sänkning). Den adaptiva EQ:n tar resonanserna oavsett.
const MIC = "condenser";
type Check = { id: string; label: string; value: number | string | null; unit?: string; requirement: string; pass: boolean; required?: boolean };
type Measure = { checks: Check[]; pass: boolean };
type State = { state: "running" | "done" | "failed"; step: string; result?: Measure; audio?: string; error?: string; name?: string };
// Kraven kommer från servern i engelskt format ("-17.5 ± 0.5"); visas med svenskt decimaltecken och minustecken.
const sv = (t: string) => t.replace(/(\d)\.(\d)/g, "$1,$2").replace(/-(?=\d)/g, "−");
const f1 = (v: number) => v.toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}/${path}`, init);
  if (!r.ok) { let m = `Fel ${r.status}`; try { const d = await r.json(); m = d.detail || d.error || m; } catch { /* text */ } throw new Error(m); }
  return r.json();
}

export default function SjobergMaster() {
  const [s, setS] = useState<State | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const running = s?.state === "running";

  async function upload(f: File, onPct: (p: number) => void): Promise<{ id: string; filename: string }> {
    const secure = window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname);
    if (secure) return studioTusUpload(f, API, (sent, total) => onPct(Math.floor(sent / total * 100)));
    const r = await fetch(`${API}/upload?filename=${encodeURIComponent(f.name)}`, { method: "POST", body: f, headers: { "content-type": "application/octet-stream" } });
    if (r.status === 413) throw new Error("Filen är större än 1000 MB. Dela upp boken per kapitel.");
    if (!r.ok) throw new Error("Uppladdningen misslyckades. Försök igen.");
    return r.json();
  }

  async function run(f: File) {
    if (running) return;
    if (!/\.(wav|mp3|m4a|aif|aiff|flac)$/i.test(f.name)) { setS({ state: "failed", step: "", error: "Välj en ljudfil i WAV, MP3, M4A, AIFF eller FLAC." }); return; }
    if (f.size > 1000 * 1024 * 1024) { setS({ state: "failed", step: "", error: "Filen får vara högst 1000 MB. Dela upp boken per kapitel." }); return; }
    setS({ state: "running", step: "Laddar upp…", name: f.name });
    try {
      const up = await upload(f, p => setS({ state: "running", step: `Laddar upp… ${p} %`, name: f.name }));
      setS({ state: "running", step: "Mastrar…", name: f.name });
      const { job } = await api<{ job: string }>(`${up.id}/master`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ declick: "av", klang: "neutral", mic: MIC }) });
      const t0 = Date.now();
      for (;;) {
        await new Promise(r => setTimeout(r, 2000));
        const j = await api<{ state: string; result?: Measure; audio?: string; error?: string }>(`jobs/${job}`);
        if (j.state === "done") { setS({ state: "done", step: "", result: j.result, audio: j.audio, name: f.name }); break; }
        if (j.state === "failed") throw new Error("Mastringen kunde inte slutföras. Försök igen eller kontakta Saltwaves.");
        const sec = Math.round((Date.now() - t0) / 1000);
        setS({ state: "running", step: `Mastrar… ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, name: f.name });
      }
    } catch (e) { setS({ state: "failed", step: "", error: e instanceof Error ? e.message : "Något gick fel.", name: f.name }); }
  }

  const pick = (f?: File) => { if (f) void run(f); };
  return <main className="ab-studio st sj-shell">
    <header className="ab-header"><Wordmark href="/tools/audiobook/sjoberg" /><span className="ab-badge">SALTWAVES · LJUDBOK</span></header>
    <section className="sj-hero">
      <p className="ab-eyebrow">SJÖBERG FÖRLAG</p>
      <h1>Ljudboksmastering</h1>
      <p>Ladda upp ett kapitel. Ljudet mastras automatiskt och levereras klart enligt Storytels krav.</p>
    </section>
    <div className="st-specbar sj-spec" aria-label="Leveranskrav"><b>Storytel</b><small>−17,5 LUFS ±0,5 · ≤ −3,0 dBTP · brus i pauser ≤ −80 dBFS · 44,1 kHz / 16 bit mono</small></div>
    <section className={`sj-drop${drag ? " is-drag" : ""}${running ? " is-busy" : ""}`}
      onDragOver={e => { e.preventDefault(); if (!running) setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
      <p className="ab-eyebrow">01 · VÄLJ FIL</p>
      <h2>{running ? s?.name : "Släpp ljudfilen här"}</h2>
      <p>WAV, MP3, M4A, AIFF eller FLAC, högst 1000 MB per fil (ungefär 3 timmar i WAV mono).</p>
      <button className="ab-master" disabled={running} onClick={() => input.current?.click()}>{running ? "Mastrar…" : "Välj fil och mastra"}<span>→</span></button>
      <input ref={input} hidden type="file" accept=".wav,.mp3,.m4a,.aif,.aiff,.flac" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {running && <p className="ab-status" role="status"><span className="ab-spinner" />{s?.step}</p>}
      {s?.state === "failed" && <p className="ab-error" role="alert">{s.error}</p>}
    </section>
    <section className="sj-result">
      <p className="ab-eyebrow">02 · RESULTAT</p>
      {s?.state !== "done" && <><h2>Här visas din master.</h2><p>När mastringen är klar ser du mätvärdena mot Storytels krav och kan ladda ner filen.</p></>}
      {s?.state === "done" && s.result && <>
        <h2>{s.result.pass ? "Klar för leverans." : "Mastern är klar, men något krav nås inte."}</h2>
        <p className={s.result.pass ? "ab-info" : "ab-error"}>{s.result.pass ? "Alla uppmätta krav klaras. Gör också en lyssningskontroll före leverans." : "Lyssna igenom filen och kontakta Saltwaves om du är osäker."}</p>
        <table className="st-checks"><thead><tr><th>Mätning</th><th>Värde</th><th>Krav</th><th>Utfall</th></tr></thead><tbody>
          {s.result.checks.filter(c => c.required !== false).map(c => <tr key={c.id}><td>{c.label}</td><td>{typeof c.value === "number" ? `${f1(c.value)} ${c.unit ?? ""}` : sv(String(c.value ?? "—"))}</td><td>{sv(c.requirement)}</td><td className={c.pass ? "st-ok" : "st-bad"}>{c.pass ? "OK" : "Utanför"}</td></tr>)}
        </tbody></table>
        {s.audio && <audio controls preload="none" src={`${API}/${s.audio}`} className="sj-player" />}
        {s.audio && <a className="ab-master sj-download" href={`${API}/${s.audio}`} download>Ladda ner master (WAV)<span>↓</span></a>}
      </>}
    </section>
    <p className="ab-retention">Uppladdade filer och resultat tas bort automatiskt. Ladda ner det du vill behålla.</p>
    <footer className="ab-footer"><span>SALTWAVES STUDIO</span><span>En fil. En enhetlig behandling.</span></footer>
  </main>;
}
