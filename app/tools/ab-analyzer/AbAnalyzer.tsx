"use client";

// app/tools/ab-analyzer/AbAnalyzer.tsx
// Saltwaves A/B Loudness Analyzer — internal tool. All analysis runs locally
// in the browser; no audio ever leaves the machine.

import { useCallback, useRef, useState } from "react";
import {
  analyzeChannels,
  decodeFileTo48k,
  meanDelta,
  DIAG_BANDS,
  type AnalysisResult,
} from "@/lib/audio-analysis";

type Slot = "A" | "B";

interface SlotState {
  name: string | null;
  status: string;
  result: AnalysisResult | null;
  error: string | null;
}

const EMPTY: SlotState = { name: null, status: "", result: null, error: null };

const fmt = (v: number | undefined | null, unit = "", digits = 1) =>
  v == null || !isFinite(v) ? "–" : `${v.toFixed(digits)}${unit}`;

const deltaFmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

export default function AbAnalyzer() {
  const [slots, setSlots] = useState<Record<Slot, SlotState>>({
    A: EMPTY,
    B: EMPTY,
  });
  const inputA = useRef<HTMLInputElement>(null);
  const inputB = useRef<HTMLInputElement>(null);

  const setSlot = (slot: Slot, patch: Partial<SlotState>) =>
    setSlots((s) => ({ ...s, [slot]: { ...s[slot], ...patch } }));

  const handleFile = useCallback(async (slot: Slot, file: File) => {
    setSlot(slot, { ...EMPTY, name: file.name, status: "Decoding…" });
    try {
      const channels = await decodeFileTo48k(file);
      const durMin = channels[0].length / 48000 / 60;
      if (durMin > 30) {
        setSlot(slot, {
          status: `Long file (${durMin.toFixed(0)} min) — this can take a while…`,
        });
      }
      const result = await analyzeChannels(channels, (stage, frac) =>
        setSlot(slot, {
          status: `Analyzing ${stage} ${(frac * 100).toFixed(0)} %`,
        })
      );
      setSlot(slot, { status: "", result });
    } catch (e) {
      setSlot(slot, {
        status: "",
        error:
          e instanceof Error && e.name === "EncodingError"
            ? "Could not decode this file. Try WAV, MP3, M4A or FLAC."
            : "Analysis failed. Check the console and try again.",
      });
    }
  }, []);

  const onDrop = (slot: Slot) => (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(slot, f);
  };

  const a = slots.A.result;
  const b = slots.B.result;
  const both = a && b;

  const metrics: {
    label: string;
    unit: string;
    get: (r: AnalysisResult) => number;
    note?: string;
  }[] = [
    {
      label: "Integrated",
      unit: " LUFS",
      get: (r) => r.integratedLufs,
      note: "Apple spec −16",
    },
    { label: "True peak", unit: " dBTP", get: (r) => r.truePeakDb },
    { label: "LRA", unit: " LU", get: (r) => r.lra },
    { label: "PLR", unit: " dB", get: (r) => r.plr },
  ];

  return (
    <div className="aba">
      <style>{CSS}</style>

      <header className="aba-head">
        <p className="aba-eyebrow">Saltwaves · internal instrument</p>
        <h1 className="aba-title">A/B Loudness Analyzer</h1>
        <p className="aba-sub">
          Drop two files — before and after — and read the difference the way a
          broadcast chain does: BS.1770-4 loudness, true peak, loudness range
          and a VAD-gated long-term spectrum, all measured locally in your
          browser. Nothing is uploaded.
        </p>
      </header>

      <div className="aba-drops">
        {(["A", "B"] as Slot[]).map((slot) => {
          const st = slots[slot];
          const ref = slot === "A" ? inputA : inputB;
          return (
            <div
              key={slot}
              className={`aba-drop aba-drop-${slot}${st.result ? " is-done" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop(slot)}
              onClick={() => ref.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") ref.current?.click();
              }}
            >
              <input
                ref={ref}
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.flac,.aac,.ogg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(slot, f);
                  e.target.value = "";
                }}
              />
              <span className="aba-drop-tag">
                {slot === "A" ? "A · Before" : "B · After"}
              </span>
              <span className="aba-drop-name">
                {st.name ?? "Drop audio here or click to browse"}
              </span>
              {st.status && <span className="aba-drop-status">{st.status}</span>}
              {st.error && <span className="aba-drop-error">{st.error}</span>}
              {st.result && (
                <span className="aba-drop-meta">
                  {(st.result.durationSec / 60).toFixed(1)} min ·{" "}
                  {st.result.ltas
                    ? `${st.result.ltas.framesKept}/${st.result.ltas.framesTotal} frames after gate`
                    : "no spectrum (file too short)"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {(a || b) && (
        <section className="aba-metrics" aria-label="Loudness metrics">
          {metrics.map((m) => (
            <div key={m.label} className="aba-metric">
              <p className="aba-metric-label">
                {m.label}
                {m.note && <span className="aba-metric-note"> · {m.note}</span>}
              </p>
              <div className="aba-metric-row">
                <span className="aba-val aba-val-a">
                  {a ? fmt(m.get(a), m.unit) : "–"}
                </span>
                <span className="aba-arrow" aria-hidden>
                  →
                </span>
                <span className="aba-val aba-val-b">
                  {b ? fmt(m.get(b), m.unit) : "–"}
                </span>
                {both && (
                  <span className="aba-delta">{deltaFmt(m.get(b) - m.get(a))}</span>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {a?.ltas || b?.ltas ? (
        <LtasChart a={a?.ltas ?? null} b={b?.ltas ?? null} />
      ) : null}

      {both && a.ltas && b.ltas && (
        <section className="aba-bands" aria-label="Diagnosis bands">
          <h2 className="aba-h2">Diagnosis bands — mean Δ (B − A)</h2>
          <div className="aba-band-grid">
            {DIAG_BANDS.map((band) => {
              const d = meanDelta(a.ltas!, b.ltas!, band.lo, band.hi);
              return (
                <div key={band.name} className="aba-band">
                  <span className="aba-band-name">{band.name}</span>
                  <span
                    className={`aba-band-delta${Math.abs(d) > 3 ? " is-big" : ""}`}
                  >
                    {deltaFmt(d)} dB
                  </span>
                </div>
              );
            })}
          </div>
          <p className="aba-foot">
            Methodology: ITU-R BS.1770-4 (K-weighted, gated) · true peak 4×
            oversampled · LTAS Hann 4096 / 50 % overlap, RMS-gated median −15
            dB, level-normalised to the 250 Hz – 4 kHz speech core. Read 9k+
            with care on lossy sources.
          </p>
        </section>
      )}
    </div>
  );
}

// ---------- Chart ----------

function LtasChart({
  a,
  b,
}: {
  a: import("@/lib/audio-analysis").LtasResult | null;
  b: import("@/lib/audio-analysis").LtasResult | null;
}) {
  const W = 860;
  const H = 400;
  const M = { top: 24, right: 20, bottom: 56, left: 52 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const curves = [a, b].filter(Boolean) as import("@/lib/audio-analysis").LtasResult[];
  const all = curves.flatMap((c) => c.levels);
  const yMin = Math.floor((Math.min(...all) - 3) / 5) * 5;
  const yMax = Math.ceil((Math.max(...all) + 3) / 5) * 5;

  const fLo = 45;
  const fHi = 18000;
  const x = (f: number) =>
    M.left + ((Math.log10(f) - Math.log10(fLo)) / (Math.log10(fHi) - Math.log10(fLo))) * iw;
  const y = (v: number) => M.top + ((yMax - v) / (yMax - yMin)) * ih;

  const path = (c: import("@/lib/audio-analysis").LtasResult) =>
    c.centers.map((f, i) => `${i ? "L" : "M"}${x(f).toFixed(1)},${y(c.levels[i]).toFixed(1)}`).join(" ");

  const zones = [
    { label: "rumble", lo: fLo, hi: 80 },
    { label: "warmth", lo: 80, hi: 160 },
    { label: "body", lo: 160, hi: 500 },
    { label: "anchor", lo: 500, hi: 6000 },
    { label: "sibilance", lo: 6000, hi: 9000 },
    { label: "air", lo: 9000, hi: fHi },
  ];

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v += 5) yTicks.push(v);
  const xTicks = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 16000];

  return (
    <section className="aba-chart" aria-label="Long-term average spectrum">
      <h2 className="aba-h2">Long-term average spectrum</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="aba-svg" role="img">
        {zones.map((z, i) => (
          <g key={z.label}>
            {i % 2 === 1 && (
              <rect
                x={x(z.lo)}
                y={M.top}
                width={x(z.hi) - x(z.lo)}
                height={ih}
                fill="rgba(26,26,26,0.045)"
              />
            )}
            <text
              x={(x(z.lo) + x(z.hi)) / 2}
              y={H - 14}
              className="aba-zone-label"
              textAnchor="middle"
            >
              {z.label}
            </text>
          </g>
        ))}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(v)}
              y2={y(v)}
              stroke="rgba(26,26,26,0.12)"
              strokeWidth={v === 0 ? 1.4 : 0.7}
            />
            <text x={M.left - 8} y={y(v) + 3.5} textAnchor="end" className="aba-tick">
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((f) => (
          <text key={f} x={x(f)} y={M.top + ih + 16} textAnchor="middle" className="aba-tick">
            {f >= 1000 ? `${f / 1000}k` : f}
          </text>
        ))}
        {a && (
          <path
            d={path(a)}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
        )}
        {b && <path d={path(b)} fill="none" stroke="#ff6200" strokeWidth={2.6} />}
        {a &&
          a.centers.map((f, i) => (
            <circle key={`a${f}`} cx={x(f)} cy={y(a.levels[i])} r={2.6} fill="#1a1a1a" />
          ))}
        {b &&
          b.centers.map((f, i) => (
            <circle key={`b${f}`} cx={x(f)} cy={y(b.levels[i])} r={2.8} fill="#ff6200" />
          ))}
        <g className="aba-legend" transform={`translate(${M.left + 10},${M.top + 6})`}>
          {a && (
            <>
              <line x1={0} x2={26} y1={6} y2={6} stroke="#1a1a1a" strokeWidth={2} strokeDasharray="6 5" />
              <text x={32} y={10} className="aba-tick">
                A · before
              </text>
            </>
          )}
          {b && (
            <>
              <line x1={110} x2={136} y1={6} y2={6} stroke="#ff6200" strokeWidth={2.6} />
              <text x={142} y={10} className="aba-tick">
                B · after
              </text>
            </>
          )}
        </g>
        <text
          x={16}
          y={M.top + ih / 2}
          className="aba-tick"
          textAnchor="middle"
          transform={`rotate(-90 16 ${M.top + ih / 2})`}
        >
          dB rel. speech core
        </text>
      </svg>
    </section>
  );
}

// ---------- Styles ----------

const CSS = `
.aba{
  --orange:#ff6200; --paper:#f1ede8; --ink:#1a1a1a;
  --ink-60:rgba(26,26,26,.6); --line:rgba(26,26,26,.16);
  background:var(--paper); color:var(--ink);
  min-height:100vh; padding:56px 24px 80px;
  font-family:'Archivo',system-ui,sans-serif;
  max-width:none;
}
.aba-head{max-width:920px;margin:0 auto 40px}
.aba-eyebrow{
  font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--orange);margin:0 0 10px;font-weight:600;
}
.aba-title{
  font-family:'Clash Display','Archivo',sans-serif;
  font-size:clamp(34px,5vw,56px);line-height:1.02;margin:0 0 14px;font-weight:600;
}
.aba-sub{max-width:640px;color:var(--ink-60);line-height:1.55;margin:0;font-size:16px}
.aba-drops{
  max-width:920px;margin:0 auto 36px;display:grid;gap:16px;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
}
.aba-drop{
  border:1.5px dashed var(--line);border-radius:14px;padding:26px 22px;
  cursor:pointer;display:flex;flex-direction:column;gap:8px;
  background:rgba(255,255,255,.35);transition:border-color .15s,background .15s;
}
.aba-drop:hover,.aba-drop:focus-visible{border-color:var(--ink);outline:none}
.aba-drop-B:hover,.aba-drop-B:focus-visible{border-color:var(--orange)}
.aba-drop.is-done{border-style:solid}
.aba-drop-B.is-done{border-color:var(--orange)}
.aba-drop-A.is-done{border-color:var(--ink)}
.aba-drop-tag{
  font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;
}
.aba-drop-B .aba-drop-tag{color:var(--orange)}
.aba-drop-name{font-size:15px;word-break:break-all}
.aba-drop-status{font-size:13px;color:var(--ink-60);font-variant-numeric:tabular-nums}
.aba-drop-error{font-size:13px;color:#b3261e}
.aba-drop-meta{font-size:12.5px;color:var(--ink-60)}
.aba-metrics{
  max-width:920px;margin:0 auto 36px;display:grid;gap:14px;
  grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
}
.aba-metric{
  background:rgba(255,255,255,.5);border:1px solid var(--line);
  border-radius:12px;padding:14px 16px;
}
.aba-metric-label{
  margin:0 0 8px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
}
.aba-metric-note{color:var(--ink-60);font-weight:400;text-transform:none;letter-spacing:0}
.aba-metric-row{
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
  font-variant-numeric:tabular-nums;
}
.aba-val{font-family:'Clash Display','Archivo',sans-serif;font-size:21px;font-weight:600}
.aba-val-b{color:var(--orange)}
.aba-arrow{color:var(--ink-60)}
.aba-delta{
  margin-left:auto;font-size:13px;font-weight:700;
  background:var(--ink);color:var(--paper);border-radius:99px;padding:3px 10px;
}
.aba-h2{
  font-family:'Clash Display','Archivo',sans-serif;
  font-size:20px;margin:0 0 14px;font-weight:600;
}
.aba-chart{max-width:920px;margin:0 auto 36px}
.aba-svg{width:100%;height:auto;display:block}
.aba-tick{font-size:11px;fill:var(--ink-60);font-family:'Archivo',sans-serif}
.aba-zone-label{
  font-size:10.5px;fill:var(--ink-60);letter-spacing:.08em;text-transform:uppercase;
  font-family:'Archivo',sans-serif;
}
.aba-bands{max-width:920px;margin:0 auto}
.aba-band-grid{
  display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
}
.aba-band{
  display:flex;justify-content:space-between;align-items:center;gap:10px;
  border:1px solid var(--line);border-radius:10px;padding:10px 14px;
  background:rgba(255,255,255,.5);font-size:13.5px;
}
.aba-band-delta{font-weight:700;font-variant-numeric:tabular-nums}
.aba-band-delta.is-big{color:var(--orange)}
.aba-foot{
  margin-top:18px;font-size:12.5px;color:var(--ink-60);line-height:1.6;max-width:720px;
}
@media (prefers-reduced-motion:reduce){
  .aba-drop{transition:none}
}
`;
