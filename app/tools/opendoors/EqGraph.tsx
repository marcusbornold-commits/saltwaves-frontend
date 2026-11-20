"use client";
// Kundens EQ: 4 band, ±3 dB, dragbara noder på en frekvensgraf (SVG). Kurvan räknas med samma biquad-formler
// som Web Audio-kedjan och serverns ffmpeg-filter (lib/studio-chain.ts bandDb).
import { useMemo, useRef, useState } from "react";
import { EQ_BANDS, EQ_MAX_DB, bandDb, eqNeutral, type Eq, type EqBand } from "@/lib/opendoors-eq";

const W = 960, H = 260, PT = 18, PB = 30, F_MIN = 30, F_MAX = 16000, DB_VIEW = 4;
const COLORS: Record<EqBand, string> = { low: "#7c8d69", lm: "#c99a3b", hm: "#1f5fbf", high: "#8b5fbf" };
const xOf = (f: number) => Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN) * W;
const fOf = (x: number) => F_MIN * Math.pow(F_MAX / F_MIN, Math.max(0, Math.min(W, x)) / W);
const yOf = (db: number) => PT + (DB_VIEW - db) / (2 * DB_VIEW) * (H - PT - PB);
const dbOf = (y: number) => DB_VIEW - (y - PT) / (H - PT - PB) * 2 * DB_VIEW;
const hz = (f: number) => f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1).replace(".", ",").replace(",0", "")} kHz` : `${Math.round(f)} Hz`;
const sdb = (g: number) => `${g > 0 ? "+" : g < 0 ? "−" : "±"}${Math.abs(g).toFixed(1).replace(".", ",")} dB`;
const clampBand = (id: EqBand, f: number, g: number) => {
  const b = EQ_BANDS.find(x => x.id === id)!;
  return { f: Math.round(Math.min(b.max, Math.max(b.min, f))), g: Math.round(Math.min(EQ_MAX_DB, Math.max(-EQ_MAX_DB, g)) * 10) / 10 };
};

export function EqGraph({ eq, onChange }: { eq: Eq; onChange: (eq: Eq) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<EqBand | null>(null);
  const [focus, setFocus] = useState<EqBand | null>(null);
  const N = 240;
  const { total, bands } = useMemo(() => {
    const fs = Array.from({ length: N }, (_, i) => F_MIN * Math.pow(F_MAX / F_MIN, i / (N - 1)));
    const bands = EQ_BANDS.map(b => fs.map(f => bandDb(b.type, eq[b.id].f, eq[b.id].g, b.q, f)));
    const total = fs.map((f, i) => [xOf(f), bands.reduce((a, v) => a + v[i], 0)] as const);
    return { total, bands: bands.map(v => v.map((db, i) => [xOf(fs[i]), db] as const)) };
  }, [eq]);
  const path = (pts: readonly (readonly [number, number])[]) => pts.map(([x, db], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yOf(db).toFixed(1)}`).join("");
  const area = (pts: readonly (readonly [number, number])[]) => `${path(pts)}L${W},${yOf(0)}L0,${yOf(0)}Z`;
  const set = (id: EqBand, f: number, g: number) => onChange({ ...eq, [id]: clampBand(id, f, g) });
  const toLocal = (e: React.PointerEvent) => { const r = svg.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  const onMove = (e: React.PointerEvent) => { if (!drag) return; const { x, y } = toLocal(e); set(drag, fOf(x), dbOf(y)); };
  const key = (id: EqBand) => (e: React.KeyboardEvent) => {
    const v = eq[id]; const big = e.shiftKey ? 2 : 1;
    const m: Record<string, [number, number]> = { ArrowUp: [1, 0.5 * big], ArrowDown: [1, -0.5 * big], ArrowRight: [Math.pow(1.06, big), 0], ArrowLeft: [1 / Math.pow(1.06, big), 0] };
    if (e.key === "0" || e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); set(id, v.f, 0); return; }
    const k = m[e.key]; if (!k) return; e.preventDefault(); set(id, v.f * k[0], v.g + k[1]);
  };
  const gridF = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const flat = EQ_BANDS.every(b => eq[b.id].g === 0 && eq[b.id].f === b.f);
  return <div className="od-eqg">
    <div className="od-eqg-head"><div><h3>EQ</h3><p className="od-muted">Dra i punkterna: upp/ner ändrar nivån (högst ±3 dB), åt sidan flyttar frekvensen. Punkt 2 (Kropp) går att flytta ner till 200 Hz, till exempel 325 Hz. Dubbelklicka på en punkt för att nollställa bandet. EQ:n gäller alla talarspår.</p></div>
      <button className="od-btn od-btn-ghost" disabled={flat} onClick={() => onChange(eqNeutral())}>Nollställ</button></div>
    <svg ref={svg} className={`od-eqg-svg${drag ? " od-eqg-drag" : ""}`} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="EQ med fyra band"
      onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      <rect x={0} y={yOf(EQ_MAX_DB)} width={W} height={yOf(-EQ_MAX_DB) - yOf(EQ_MAX_DB)} className="od-eqg-range" />
      {gridF.map(f => <g key={f}><line x1={xOf(f)} x2={xOf(f)} y1={PT} y2={H - PB} className="od-eqg-grid" /><text x={xOf(f)} y={H - 10} textAnchor="middle" className="od-eqg-lab">{hz(f).replace(" Hz", "").replace(" kHz", "k")}</text></g>)}
      {[-3, 0, 3].map(db => <g key={db}><line x1={0} x2={W} y1={yOf(db)} y2={yOf(db)} className={db === 0 ? "od-eqg-zero" : "od-eqg-grid"} /><text x={6} y={yOf(db) - 4} className="od-eqg-lab">{db > 0 ? "+3" : db < 0 ? "−3" : "0 dB"}</text></g>)}
      {EQ_BANDS.map((b, i) => <path key={b.id} d={area(bands[i])} fill={COLORS[b.id]} opacity={drag === b.id || focus === b.id ? 0.28 : 0.13} />)}
      {EQ_BANDS.map(b => <line key={b.id} x1={xOf(b.min)} x2={xOf(b.max)} y1={H - PB + 1} y2={H - PB + 1} stroke={COLORS[b.id]} strokeWidth={drag === b.id || focus === b.id ? 4 : 0} />)}
      <path d={path(total)} className="od-eqg-curve" />
      {EQ_BANDS.map((b, i) => { const v = eq[b.id], cx = xOf(v.f), cy = yOf(v.g), on = drag === b.id || focus === b.id;
        return <g key={b.id} className="od-eqg-node" tabIndex={0} role="slider" aria-label={`${b.label}, ${hz(v.f)}`} aria-valuemin={-EQ_MAX_DB} aria-valuemax={EQ_MAX_DB} aria-valuenow={v.g} aria-valuetext={`${sdb(v.g)} vid ${hz(v.f)}`}
          onPointerDown={e => { e.preventDefault(); svg.current?.setPointerCapture(e.pointerId); setDrag(b.id); }}
          onDoubleClick={() => set(b.id, v.f, 0)} onKeyDown={key(b.id)} onFocus={() => setFocus(b.id)} onBlur={() => setFocus(null)}>
          <circle cx={cx} cy={cy} r={26} fill="transparent" />
          <circle cx={cx} cy={cy} r={on ? 15 : 13} fill={on ? COLORS[b.id] : "#fff"} stroke={COLORS[b.id]} strokeWidth={3} />
          <text x={cx} y={cy + 5} textAnchor="middle" className="od-eqg-num" fill={on ? "#fff" : COLORS[b.id]}>{i + 1}</text>
        </g>; })}
    </svg>
    <div className="od-eqg-bands">{EQ_BANDS.map((b, i) => { const v = eq[b.id]; return <div key={b.id} style={{ borderColor: COLORS[b.id] }} className={drag === b.id || focus === b.id ? "on" : ""}>
      <span><i style={{ background: COLORS[b.id] }}>{i + 1}</i>{b.label}</span><b>{sdb(v.g)}</b><small>{hz(v.f)} · {b.type === "peaking" ? "topp" : b.type === "lowshelf" ? "lågshelf" : "högshelf"}</small></div>; })}</div>
  </div>;
}
