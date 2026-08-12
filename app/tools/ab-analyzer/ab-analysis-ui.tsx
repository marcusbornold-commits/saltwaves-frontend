"use client";

import {
  analyzeChannels,
  decodeFileTo48k,
  meanDelta,
  DIAG_BANDS,
  type AnalysisResult,
  type LtasResult,
} from "@/lib/audio-analysis";

export const fmt = (v: number | undefined | null, unit = "", digits = 1) =>
  v == null || !isFinite(v) ? "–" : `${v.toFixed(digits)}${unit}`;

export const deltaFmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

export const ABA_METRICS: {
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

export async function analyzeAudioFile(
  file: File,
  onStatus?: (status: string) => void,
): Promise<AnalysisResult> {
  onStatus?.("Decoding…");
  const channels = await decodeFileTo48k(file);
  const durMin = channels[0].length / 48000 / 60;
  if (durMin > 30) {
    onStatus?.(`Long file (${durMin.toFixed(0)} min) — this can take a while…`);
  }
  return analyzeChannels(channels, (stage, frac) =>
    onStatus?.(`Analyzing ${stage} ${(frac * 100).toFixed(0)} %`),
  );
}

export function decodeAnalysisError(e: unknown): string {
  if (e instanceof Error && e.name === "EncodingError") {
    return "Could not decode this file. Try WAV, MP3, M4A or FLAC.";
  }
  return "Analysis failed. Check the console and try again.";
}

export function AbAnalysisResults({
  a,
  b,
  label,
}: {
  a: AnalysisResult | null;
  b: AnalysisResult | null;
  label?: string | null;
}) {
  const both = a && b;

  if (!a && !b) return null;

  return (
    <>
      {label && (a || b) && <h2 className="aba-result-label">{label}</h2>}

      <section className="aba-metrics" aria-label="Loudness metrics">
        {ABA_METRICS.map((m) => (
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

      {a?.ltas || b?.ltas ? <LtasChart a={a?.ltas ?? null} b={b?.ltas ?? null} /> : null}

      {both && a.ltas && b.ltas && (
        <section className="aba-bands" aria-label="Diagnosis bands">
          <h2 className="aba-h2">Diagnosis bands — mean Δ (B − A)</h2>
          <p className="aba-bands-note">
            Band deltas are relative to the 250 Hz – 4 kHz speech core
            (reference shift, not a boost or raise).
          </p>
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
            dB, level-normalised to the 250 Hz – 4 kHz speech core (reference
            shift, not a boost). Read 9k+ with care on lossy sources.
          </p>
        </section>
      )}
    </>
  );
}

function LtasChart({ a, b }: { a: LtasResult | null; b: LtasResult | null }) {
  const W = 860;
  const H = 400;
  const M = { top: 24, right: 20, bottom: 56, left: 52 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const curves = [a, b].filter(Boolean) as LtasResult[];
  const all = curves.flatMap((c) => c.levels);
  const yMin = Math.floor((Math.min(...all) - 3) / 5) * 5;
  const yMax = Math.ceil((Math.max(...all) + 3) / 5) * 5;

  const fLo = 45;
  const fHi = 18000;
  const x = (f: number) =>
    M.left +
    ((Math.log10(f) - Math.log10(fLo)) / (Math.log10(fHi) - Math.log10(fLo))) * iw;
  const y = (v: number) => M.top + ((yMax - v) / (yMax - yMin)) * ih;

  const path = (c: LtasResult) =>
    c.centers
      .map((f, i) => `${i ? "L" : "M"}${x(f).toFixed(1)},${y(c.levels[i]).toFixed(1)}`)
      .join(" ");

  const zones = [
    { label: "rumble", lo: fLo, hi: 80 },
    { label: "warmth", lo: 80, hi: 160 },
    { label: "body", lo: 160, hi: 500 },
    { label: "anchor", lo: 500, hi: 6000 },
    { label: "6–9k rel.", lo: 6000, hi: 9000 },
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
              <line
                x1={0}
                x2={26}
                y1={6}
                y2={6}
                stroke="#1a1a1a"
                strokeWidth={2}
                strokeDasharray="6 5"
              />
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

export const ABA_CSS = `
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
.aba-remote-loading{
  max-width:920px;margin:0 auto 24px;display:flex;align-items:center;gap:12px;
  padding:14px 18px;border:1px solid var(--line);border-radius:12px;
  background:rgba(255,255,255,.55);font-size:14px;color:var(--ink-60);
}
.aba-remote-spinner{
  width:18px;height:18px;border:2px solid var(--line);border-top-color:var(--orange);
  border-radius:50%;animation:aba-spin .7s linear infinite;flex-shrink:0;
}
@keyframes aba-spin{to{transform:rotate(360deg)}}
.aba-remote-error{
  max-width:920px;margin:0 auto 24px;padding:16px 18px;border-radius:12px;
  border:1px solid #f5c2c0;background:#fdecea;color:#5f2120;
}
.aba-remote-error-title{margin:0 0 6px;font-weight:700;font-size:14px}
.aba-remote-error-msg,.aba-remote-error-hint{margin:0;font-size:13.5px;line-height:1.5}
.aba-remote-error-hint{margin-top:8px;color:rgba(95,33,32,.75)}
.aba-result-label{
  max-width:920px;margin:0 auto 20px;
  font-family:'Clash Display','Archivo',sans-serif;
  font-size:clamp(22px,3vw,30px);font-weight:600;line-height:1.15;
}
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
.aba-bands-note{
  margin:-6px 0 14px;font-size:12.5px;color:var(--ink-60);line-height:1.5;max-width:720px;
}
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
  .aba-remote-spinner{animation:none;border-top-color:var(--orange)}
}
`;
