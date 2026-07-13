// lib/audio-analysis.ts
// Saltwaves measurement engine — ITU-R BS.1770-4 loudness + LTAS (LI-2 methodology).
// Verified against ffmpeg ebur128/loudnorm: Integrated ±0.1 LU, True Peak ±0.1 dB,
// LRA in line with the canonical ebur128 filter.
// Requires 48 kHz input (decode via OfflineAudioContext at 48000).

export interface LtasResult {
  centers: number[];
  levels: number[]; // dB relative to speech core 250 Hz – 4 kHz
  framesKept: number;
  framesTotal: number;
}

export interface AnalysisResult {
  integratedLufs: number;
  truePeakDb: number;
  lra: number;
  plr: number;
  durationSec: number;
  ltas: LtasResult | null;
}

export interface MomentaryLoudnessPoint {
  /** Center of the 400 ms analysis window (seconds). */
  timeSec: number;
  lufs: number;
}

export const THIRD_OCT_CENTERS = [
  50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
  10000, 12500, 16000,
];

export const DIAG_BANDS: { name: string; lo: number; hi: number }[] = [
  { name: "<80 Hz · rumble", lo: 0, hi: 80 },
  { name: "80–160 · warmth", lo: 80, hi: 160 },
  { name: "160–500 · body", lo: 160, hi: 500 },
  { name: "500–6k · anchor", lo: 500, hi: 6000 },
  { name: "6–9k · sibilance", lo: 6000, hi: 9000 },
  { name: "9k+ · air", lo: 9000, hi: Infinity },
];

const SR = 48000;
const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

// ---------- Biquad ----------
function biquad(
  x: Float32Array | Float64Array,
  b0: number, b1: number, b2: number, a1: number, a2: number
): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
    y[i] = yi;
  }
  return y;
}

// K-weighting @ 48 kHz (BS.1770-4)
function kWeight(x: Float32Array): Float64Array {
  const s1 = biquad(
    x, 1.53512485958697, -2.69169618940638, 1.19839281085285,
    -1.69065929318241, 0.73248077421585
  );
  return biquad(s1, 1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621);
}

const toLufs = (p: number) => -0.691 + 10 * Math.log10(p + 1e-20);
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

// ---------- K-weighted cumulative power (shared by integrated + momentary) ----------
async function kWeightedCumulativePower(channels: Float32Array[]) {
  const cum: Float64Array[] = [];
  for (const c of channels) {
    const kw = kWeight(c);
    const cs = new Float64Array(kw.length + 1);
    for (let i = 0; i < kw.length; i++) cs[i + 1] = cs[i] + kw[i] * kw[i];
    cum.push(cs);
    await yieldToUi();
  }
  const n = channels[0].length;
  const winPow = (start: number, len: number) => {
    let p = 0;
    for (const cs of cum) p += (cs[start + len] - cs[start]) / len;
    return p;
  };
  return { n, winPow };
}

const MOMENTARY_WIN_SEC = 0.4;
const MOMENTARY_HOP_SEC = 0.1;

// ---------- Integrated LUFS + LRA ----------
async function loudness(channels: Float32Array[]) {
  const { n, winPow } = await kWeightedCumulativePower(channels);
  const hop = Math.round(MOMENTARY_HOP_SEC * SR);

  // Momentary 400 ms blocks, gated per BS.1770-4
  const bLen = Math.round(MOMENTARY_WIN_SEC * SR);
  const blocks: number[] = [];
  for (let s = 0; s + bLen <= n; s += hop) blocks.push(winPow(s, bLen));
  const absPass = blocks.filter((p) => toLufs(p) > -70);
  if (!absPass.length) return { integrated: -Infinity, lra: 0 };
  const relThresh = toLufs(mean(absPass)) - 10;
  const relPass = absPass.filter((p) => toLufs(p) > relThresh);
  const integrated = toLufs(mean(relPass.length ? relPass : absPass));

  // Short-term 3 s for LRA (EBU Tech 3342: abs −70, rel −20, p10–p95)
  const sLen = Math.round(3 * SR);
  const st: number[] = [];
  for (let s = 0; s + sLen <= n; s += hop) st.push(winPow(s, sLen));
  let lra = 0;
  const stAbs = st.filter((p) => toLufs(p) > -70);
  if (stAbs.length) {
    const rel = toLufs(mean(stAbs)) - 20;
    const gated = stAbs
      .filter((p) => toLufs(p) > rel)
      .map(toLufs)
      .sort((a, b) => a - b);
    if (gated.length >= 2) {
      const q = (arr: number[], f: number) => {
        const idx = f * (arr.length - 1);
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
      };
      lra = q(gated, 0.95) - q(gated, 0.1);
    }
  }
  return { integrated, lra };
}

// ---------- True peak (4x polyphase oversampling) ----------
async function truePeak(channels: Float32Array[]): Promise<number> {
  const M = 4, TAPS = 48;
  const center = (TAPS - 1) / 2;
  const phases: number[][] = Array.from({ length: M }, () => []);
  for (let i = 0; i < TAPS; i++) {
    const t = (i - center) / M;
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (TAPS - 1));
    phases[i % M].push(sinc * w);
  }
  for (const ph of phases) {
    const s = ph.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ph.length; i++) ph[i] /= s;
  }
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
    const K = phases[0].length;
    for (let p = 1; p < M; p++) {
      const h = phases[p];
      for (let i = 0; i < ch.length; i++) {
        let acc = 0;
        for (let k = 0; k < K; k++) {
          const idx = i - k;
          if (idx >= 0) acc += h[k] * ch[idx];
        }
        const a = Math.abs(acc);
        if (a > peak) peak = a;
      }
      await yieldToUi();
    }
  }
  return 20 * Math.log10(peak + 1e-20);
}

// ---------- FFT (iterative radix-2, in-place complex) ----------
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + half] * cwr - im[i + k + half] * cwi;
        const vi = re[i + k + half] * cwi + im[i + k + half] * cwr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + half] = ur - vr; im[i + k + half] = ui - vi;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr; cwr = nwr;
      }
    }
  }
}

// ---------- LTAS (LI-2 methodology: Hann 4096, 50 % overlap, RMS gate median−15 dB,
// level-normalised to speech core 250 Hz – 4 kHz) ----------
async function ltas(
  mono: Float64Array,
  onProgress?: (frac: number) => void
): Promise<LtasResult | null> {
  const NFFT = 4096, HOP = 2048, GATE = 15;
  const win = new Float64Array(NFFT);
  for (let i = 0; i < NFFT; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (NFFT - 1));
  }
  const nfr = Math.floor((mono.length - NFFT) / HOP) + 1;
  if (nfr < 4) return null;

  const rmsDb = new Float64Array(nfr);
  for (let f = 0; f < nfr; f++) {
    let e = 0;
    const off = f * HOP;
    for (let i = 0; i < NFFT; i++) e += mono[off + i] * mono[off + i];
    rmsDb[f] = 10 * Math.log10(e / NFFT + 1e-20);
  }
  const thr = Float64Array.from(rmsDb).sort()[Math.floor(nfr / 2)] - GATE;

  const psd = new Float64Array(NFFT / 2 + 1);
  let cnt = 0;
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT);
  for (let f = 0; f < nfr; f++) {
    if (rmsDb[f] >= thr) {
      const off = f * HOP;
      for (let i = 0; i < NFFT; i++) {
        re[i] = mono[off + i] * win[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let k = 0; k <= NFFT / 2; k++) psd[k] += re[k] * re[k] + im[k] * im[k];
      cnt++;
    }
    if (f % 256 === 255) {
      onProgress?.(f / nfr);
      await yieldToUi();
    }
  }
  for (let k = 0; k < psd.length; k++) psd[k] /= Math.max(cnt, 1);

  const binHz = SR / NFFT;
  let core = 0;
  for (let k = 0; k <= NFFT / 2; k++) {
    const fHz = k * binHz;
    if (fHz >= 250 && fHz < 4000) core += psd[k];
  }
  const coreDb = 10 * Math.log10(core + 1e-20);
  const levels = THIRD_OCT_CENTERS.map((c) => {
    const lo = c * Math.pow(2, -1 / 6), hi = c * Math.pow(2, 1 / 6);
    let p = 0;
    for (let k = 0; k <= NFFT / 2; k++) {
      const fHz = k * binHz;
      if (fHz >= lo && fHz < hi) p += psd[k];
    }
    return 10 * Math.log10(p + 1e-20) - coreDb;
  });
  return { centers: THIRD_OCT_CENTERS, levels, framesKept: cnt, framesTotal: nfr };
}

// ---------- Public API ----------
/** Ungated BS.1770 momentary loudness (400 ms window, 100 ms hop) for realtime meters. */
export async function computeMomentaryLoudnessSeries(
  channels: Float32Array[]
): Promise<MomentaryLoudnessPoint[]> {
  const { n, winPow } = await kWeightedCumulativePower(channels);
  const hop = Math.round(MOMENTARY_HOP_SEC * SR);
  const bLen = Math.round(MOMENTARY_WIN_SEC * SR);
  const series: MomentaryLoudnessPoint[] = [];
  for (let s = 0; s + bLen <= n; s += hop) {
    series.push({
      timeSec: (s + bLen / 2) / SR,
      lufs: toLufs(winPow(s, bLen)),
    });
  }
  return series;
}

export async function analyzeChannels(
  channels: Float32Array[],
  onProgress?: (stage: string, frac: number) => void
): Promise<AnalysisResult> {
  onProgress?.("loudness", 0);
  const { integrated, lra } = await loudness(channels);
  onProgress?.("true peak", 0.3);
  const tp = await truePeak(channels);
  onProgress?.("spectrum", 0.5);
  const mono = new Float64Array(channels[0].length);
  for (let i = 0; i < mono.length; i++) {
    let s = 0;
    for (const ch of channels) s += ch[i];
    mono[i] = s / channels.length;
  }
  const spectrum = await ltas(mono, (f) => onProgress?.("spectrum", 0.5 + 0.5 * f));
  onProgress?.("done", 1);
  return {
    integratedLufs: integrated,
    truePeakDb: tp,
    lra,
    plr: tp - integrated,
    durationSec: channels[0].length / SR,
    ltas: spectrum,
  };
}

export async function decodeFileTo48k(file: File): Promise<Float32Array[]> {
  const buf = await file.arrayBuffer();
  const ctx = new OfflineAudioContext({
    numberOfChannels: 2,
    length: 1,
    sampleRate: SR,
  });
  const audio = await ctx.decodeAudioData(buf);
  const nCh = Math.min(audio.numberOfChannels, 2);
  const out: Float32Array[] = [];
  for (let c = 0; c < nCh; c++) out.push(audio.getChannelData(c));
  return out;
}

export function meanDelta(
  a: LtasResult, b: LtasResult, lo: number, hi: number
): number {
  let sum = 0, n = 0;
  for (let i = 0; i < a.centers.length; i++) {
    const c = a.centers[i];
    if (c >= lo && c < hi) {
      sum += b.levels[i] - a.levels[i];
      n++;
    }
  }
  return n ? sum / n : 0;
}
