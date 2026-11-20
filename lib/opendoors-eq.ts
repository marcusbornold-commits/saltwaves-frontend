// ---- EQ för Open Doors: samma 4 band, ±3 dB och kurvformler som Earselect-studions EQ ----
// Måste matcha EQ_BANDS/EQ_MAX_DB i app/opendoors_eq.py (PodMaster). Servern klampar likadant.
// Band "lm" (200–1000 Hz, standard 400) täcker 325 Hz. Standard = platt (0 dB).
export type EqBand = "low" | "lm" | "hm" | "high";
export type Eq = Record<EqBand, { f: number; g: number }>;
export const EQ_MAX_DB = 3;
export const EQ_BANDS: { id: EqBand; type: "lowshelf" | "peaking" | "highshelf"; label: string; f: number; min: number; max: number; q: number }[] = [
  { id: "low", type: "lowshelf", label: "Bas", f: 120, min: 60, max: 250, q: 1 },
  { id: "lm", type: "peaking", label: "Kropp", f: 400, min: 200, max: 1000, q: 1 },
  { id: "hm", type: "peaking", label: "Närvaro", f: 2500, min: 1200, max: 5000, q: 1 },
  { id: "high", type: "highshelf", label: "Luft", f: 8000, min: 4000, max: 12000, q: 1 },
];
export const eqNeutral = (): Eq => Object.fromEntries(EQ_BANDS.map(b => [b.id, { f: b.f, g: 0 }])) as Eq;
export function clampEq(eq?: Partial<Record<EqBand, { f?: number; g?: number }>> | null): Eq {
  const out = eqNeutral();
  for (const b of EQ_BANDS) {
    const v = eq?.[b.id]; if (!v) continue;
    const f = Number(v.f ?? b.f), g = Number(v.g ?? 0); if (!Number.isFinite(f) || !Number.isFinite(g)) continue;
    out[b.id] = { f: Math.round(Math.min(b.max, Math.max(b.min, f))), g: Math.round(Math.min(EQ_MAX_DB, Math.max(-EQ_MAX_DB, g)) * 10) / 10 };
  }
  return out;
}
/** Magnitud (dB) för ett RBJ-biquadband vid frekvens f (samma formler som Web Audio och ffmpeg; shelf S=1). */
export function bandDb(type: "lowshelf" | "peaking" | "highshelf", f0: number, gain: number, q: number, f: number, sr = 48000) {
  const A = Math.pow(10, gain / 40), w0 = 2 * Math.PI * f0 / sr, cw = Math.cos(w0), sw = Math.sin(w0);
  let b0, b1, b2, a0, a1, a2;
  if (type === "peaking") { const al = sw / (2 * q); b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else {
    const al = sw / 2 * Math.SQRT2, sA = 2 * Math.sqrt(A) * al;
    if (type === "lowshelf") { b0 = A * ((A + 1) - (A - 1) * cw + sA); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sA); a0 = (A + 1) + (A - 1) * cw + sA; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sA; }
    else { b0 = A * ((A + 1) + (A - 1) * cw + sA); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sA); a0 = (A + 1) - (A - 1) * cw + sA; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sA; }
  }
  const w = 2 * Math.PI * f / sr, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

// ---- Panorering per spår (konstant effekt, som servern) ----
export const PAN_MIN = -100, PAN_MAX = 100;
export const clampPan = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(Math.min(PAN_MAX, Math.max(PAN_MIN, n))) : null;
};
/** Standardplacering: 1 spår = mitten, 2 eller fler = jämnt från −50 (vänster) till +50 (höger). */
export const defaultPans = (n: number): number[] =>
  n <= 0 ? [] : n === 1 ? [0] : Array.from({ length: n }, (_, i) => Math.round(-50 + (100 * i) / (n - 1)));
export const panLabel = (p: number) => (p === 0 ? "Mitten" : p < 0 ? `Vänster ${Math.abs(p)}` : `Höger ${p}`);
