// Saltwaves Studio v1 – webbläsarens bearbetningskedja.
// Måste spegla backend/studio_engine.py (chain_filter + finalize) i saltwaves-audiobook.
export type Params = {
  hpf: number;
  low: { f: number; g: number };
  mid: { f: number; g: number; q: number };
  high: { f: number; g: number };
  comp: { on: boolean; threshold: number; ratio: number; attack: number; release: number; knee: number };
  deess: { on: boolean; freq: number; threshold: number; ratio: number };
  limiter: { ceiling: number };
  declick: boolean;
  dfn: boolean;
};
export type Spec = { id: string; label: string; metric: "lufs" | "rms"; target: number; tolerance?: number; range?: [number, number]; peak_kind: "tp" | "sample"; peak_max: number; noise_max: number; note?: string; source?: string };

const BUTTERWORTH_DB = -3.0103; // Web Audio: Q för low/highpass anges i dB
const PREDELAY = 0.006; // DynamicsCompressor lookahead i Chrome/Safari


const LIMITER_SRC = `class L extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:"ceiling",defaultValue:0.668,automationRate:"k-rate"}]}
constructor(){super();this.la=Math.round(sampleRate*0.005);this.N=this.la+1;this.M=this.N+4;this.buf=new Float32Array(this.N);this.w=0;this.t=0;this.qv=new Float32Array(this.M);this.qi=new Float64Array(this.M);this.h=0;this.e=0;this.g=1;this.rel=Math.exp(-1/(sampleRate*0.08));}
process(inp,out,p){const y=out[0][0];const x=inp[0]&&inp[0][0];const c=p.ceiling[0];for(let n=0;n<y.length;n++){const s=x?x[n]:0;const a=Math.abs(s);const v=a>c?c/a:1;this.t++;while(this.e>this.h&&this.qv[(this.e-1)%this.M]>=v)this.e--;this.qv[this.e%this.M]=v;this.qi[this.e%this.M]=this.t;this.e++;while(this.qi[this.h%this.M]<=this.t-this.N)this.h++;const d=this.qv[this.h%this.M];this.g=d<this.g?d:this.rel*this.g+(1-this.rel)*d;const r=(this.w+1)%this.N;this.buf[this.w]=s;y[n]=this.buf[r]*this.g;this.w=r;}for(let ch=1;ch<out[0].length;ch++)out[0][ch].set(y);return true}}
registerProcessor("sw-limiter",L);`;
let limiterUrl: string | null = null;
export async function loadLimiter(ctx: BaseAudioContext) {
  if (!limiterUrl) limiterUrl = URL.createObjectURL(new Blob([LIMITER_SRC], { type: "application/javascript" }));
  // AudioWorklet finns bara i säker kontext (https/localhost). Över http://<tailscale-ip> faller vi tillbaka på en kompressor-limiter.
  if (!ctx.audioWorklet) return false;
  await ctx.audioWorklet.addModule(limiterUrl);
  return true;
}

export type Chain = { input: AudioNode; preLimiter: GainNode; autoGain: GainNode; output: AudioNode; update: (p: Params, autoGainDb: number) => void };

export function buildChain(ctx: BaseAudioContext, p: Params, autoGainDb: number, withLimiter = true): Chain {
  const input = ctx.createGain();
  const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.Q.value = BUTTERWORTH_DB;
  const low = ctx.createBiquadFilter(); low.type = "lowshelf";
  const mid = ctx.createBiquadFilter(); mid.type = "peaking";
  const high = ctx.createBiquadFilter(); high.type = "highshelf";
  const comp = ctx.createDynamicsCompressor(); const compMakeup = ctx.createGain();
  const compBypass = ctx.createGain(); const compWet = ctx.createGain();
  const deIn = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = BUTTERWORTH_DB;
  const lpDelay = ctx.createDelay(0.05); lpDelay.delayTime.value = PREDELAY;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.Q.value = BUTTERWORTH_DB;
  const de = ctx.createDynamicsCompressor(); de.attack.value = 0.001; de.release.value = 0.06; de.knee.value = 2;
  const deMakeup = ctx.createGain(); const deWet = ctx.createGain(); const deBypass = ctx.createGain();
  const preLimiter = ctx.createGain(); const autoGain = ctx.createGain();
  input.connect(hpf).connect(low).connect(mid).connect(high);
  high.connect(comp).connect(compMakeup).connect(compWet).connect(deIn);
  high.connect(compBypass).connect(deIn);
  deIn.connect(lp).connect(lpDelay).connect(deWet);
  deIn.connect(hp).connect(de).connect(deMakeup).connect(deWet);
  deWet.connect(preLimiter); deIn.connect(deBypass).connect(preLimiter);
  preLimiter.connect(autoGain);
  let output: AudioNode = autoGain;
  let limiter: AudioWorkletNode | null = null; let fallback: DynamicsCompressorNode | null = null;
  if (withLimiter && ctx.audioWorklet) { limiter = new AudioWorkletNode(ctx, "sw-limiter"); autoGain.connect(limiter); output = limiter; }
  else if (withLimiter) { fallback = ctx.createDynamicsCompressor(); fallback.ratio.value = 20; fallback.knee.value = 0; fallback.attack.value = 0.001; fallback.release.value = 0.08; autoGain.connect(fallback); output = fallback; }
  const update = (q: Params, ag: number) => {
    hpf.frequency.value = q.hpf > 0 ? q.hpf : 1;
    low.frequency.value = q.low.f; low.gain.value = q.low.g;
    mid.frequency.value = q.mid.f; mid.gain.value = q.mid.g; mid.Q.value = q.mid.q;
    high.frequency.value = q.high.f; high.gain.value = q.high.g;
    comp.threshold.value = q.comp.threshold; comp.ratio.value = q.comp.ratio; comp.attack.value = q.comp.attack / 1000; comp.release.value = q.comp.release / 1000; comp.knee.value = q.comp.knee;
    compMakeup.gain.value = dbToLin(-compMakeupDb(q.comp.threshold, q.comp.ratio));
    compWet.gain.value = q.comp.on ? 1 : 0; compBypass.gain.value = q.comp.on ? 0 : 1;
    lp.frequency.value = q.deess.freq; hp.frequency.value = q.deess.freq;
    de.threshold.value = q.deess.threshold; de.ratio.value = q.deess.ratio;
    deMakeup.gain.value = dbToLin(-compMakeupDb(q.deess.threshold, q.deess.ratio));
    deWet.gain.value = q.deess.on ? 1 : 0; deBypass.gain.value = q.deess.on ? 0 : 1;
    autoGain.gain.value = dbToLin(ag);
    if (limiter) limiter.parameters.get("ceiling")!.value = dbToLin(Math.min(q.limiter.ceiling, -3.3));
    if (fallback) fallback.threshold.value = Math.min(q.limiter.ceiling, -3.3) - 1.5;
  };
  update(p, autoGainDb);
  return { input, preLimiter, autoGain, output, update };
}

// Makeup gain enligt Web Audio-specen: (1/kurva(0 dBFS))^0.6
export function compMakeupDb(threshold: number, ratio: number) {
  const out0 = threshold + (0 - threshold) / ratio; // utnivå vid 0 dBFS in
  return -0.6 * out0;
}
export const dbToLin = (db: number) => Math.pow(10, db / 20);
export const linToDb = (x: number) => 20 * Math.log10(Math.max(x, 1e-12));

// ---- BS.1770 K-vikt + gating ----
function biquad(x: Float32Array, b: number[], a: number[]) {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) { const v = b[0] * x[n] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[n]; y2 = y1; y1 = v; y[n] = v; }
  return y;
}
function kCoeffs(sr: number) {
  // pyloudnorm-parametrar
  let G = 3.99984385397, Q = 0.7071752369554193, fc = 1681.9744509555319;
  let A = Math.pow(10, G / 40), w0 = 2 * Math.PI * fc / sr, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0);
  const sb = [A * ((A + 1) + (A - 1) * c + 2 * Math.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * Math.sqrt(A) * al)];
  const sa = [(A + 1) - (A - 1) * c + 2 * Math.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * Math.sqrt(A) * al];
  G = 0; Q = 0.5003270373253953; fc = 38.13547087613982; A = 1; w0 = 2 * Math.PI * fc / sr; al = Math.sin(w0) / (2 * Q); c = Math.cos(w0);
  const hb = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; const ha = [1 + al, -2 * c, 1 - al];
  const n = (b: number[], a: number[]) => [b.map(v => v / a[0]), a.map(v => v / a[0])];
  return [n(sb, sa), n(hb, ha)];
}
export function integratedLufs(x: Float32Array, sr: number) {
  const [[b1, a1], [b2, a2]] = kCoeffs(sr);
  const k = biquad(biquad(x, b1, a1), b2, a2);
  const block = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), z: number[] = [];
  for (let s = 0; s + block <= k.length; s += hop) { let e = 0; for (let i = s; i < s + block; i++) e += k[i] * k[i]; z.push(e / block); }
  const l = (m: number) => -0.691 + 10 * Math.log10(m);
  let g = z.filter(m => l(m) > -70); if (!g.length) return -Infinity;
  const rel = l(g.reduce((a, b) => a + b, 0) / g.length) - 10;
  g = g.filter(m => l(m) > rel);
  return l(g.reduce((a, b) => a + b, 0) / g.length);
}
export function rmsDb(x: Float32Array) { let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i]; return 10 * Math.log10(e / x.length + 1e-24); }
export function peakDb(x: Float32Array) { let p = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; } return linToDb(p); }

// Pausexpander, variant B. Måste matcha PAUSE_EXPANDER + pause_expander() i backend/studio_engine.py.
export const PAUSE_EXPANDER = { block_ms: 1, det_ms: 10, hp_hz: 120, open_db: -48, close_db: -55, hold_ms: 60, lookahead_ms: 10, floor_db: -87, range_db: 30, level_ms: 60, attack_ms: 3, release_ms: 150 };
function hp2(x: Float32Array, sr: number, f: number) {
  // 2:a ordningens Butterworth-högpass, framåt och bakåt (som sosfiltfilt) för sidokedjan
  const w = Math.tan(Math.PI * f / sr), k = 1 / (1 + Math.SQRT2 * w + w * w);
  const b = [k, -2 * k, k], a = [1, 2 * (w * w - 1) * k, (1 - Math.SQRT2 * w + w * w) * k];
  const run = (v: Float32Array) => biquad(v, b, a);
  return run(run(x).reverse()).reverse();
}
export function pauseExpander(x: Float32Array, sr: number, p = PAUSE_EXPANDER): Float32Array {
  const blk = Math.round(sr * p.block_ms / 1000), nb = Math.floor(x.length / blk) + 1;
  const sc = hp2(x, sr, p.hp_hz); const e = new Float64Array(nb), ef = new Float64Array(nb);
  for (let i = 0; i < x.length; i++) { const j = (i / blk) | 0; e[j] += sc[i] * sc[i] / blk; ef[j] += x[i] * x[i] / blk; }
  const smooth = (v: Float64Array, ms: number) => { const n = Math.max(1, Math.round(ms / p.block_ms)), o = new Float64Array(nb), c = new Float64Array(nb + 1); for (let i = 0; i < nb; i++) c[i + 1] = c[i] + v[i]; const h = Math.floor(n / 2); for (let i = 0; i < nb; i++) { const lo = i - (n - 1 - h) , hi = i + h; o[i] = (c[Math.min(nb, Math.max(0, hi + 1))] - c[Math.max(0, Math.min(nb, lo))]) / n; } return o; };
  const ds = smooth(e, p.det_ms), ls = smooth(ef, p.level_ms);
  const la = Math.round(p.lookahead_ms / p.block_ms), hold = Math.round(p.hold_ms / p.block_ms);
  const g = new Float32Array(nb); let open = true, cnt = 0, cur = 0;
  const aUp = Math.exp(-p.block_ms / p.attack_ms), aDn = Math.exp(-p.block_ms / p.release_ms);
  for (let i = 0; i < nb; i++) {
    const det = 10 * Math.log10(ds[Math.min(nb - 1, i + la)] + 1e-20), lvl = 10 * Math.log10(ls[i] + 1e-20);
    if (det > p.open_db) { open = true; cnt = hold; } else if (det < p.close_db) { if (cnt > 0) cnt--; else open = false; } else if (open) cnt = hold;
    const t = open ? 0 : -Math.min(p.range_db, Math.max(0, lvl - p.floor_db));
    const c = t > cur ? aUp : aDn; cur = c * cur + (1 - c) * t; g[i] = cur;
  }
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) { const f = i / blk - 0.5, j = Math.max(0, Math.min(nb - 2, Math.floor(f))), u = Math.max(0, Math.min(1, f - j)); y[i] = x[i] * Math.pow(10, (g[j] * (1 - u) + g[j + 1] * u) / 20); }
  return y;
}
/** Brus i pauser, samma metod som backend pause_stats(): 20 ms RMS, 10 ms hopp, tyst = under p95 − 35 dB, sjok ≥ 250 ms, 50 ms marginal. */
export function pauseMedian(x: Float32Array, sr: number): number | null {
  const w = Math.round(0.02 * sr), h = Math.round(0.01 * sr); if (x.length < w) return null;
  const n = 1 + Math.floor((x.length - w) / h), db = new Float64Array(n);
  for (let k = 0; k < n; k++) { let e = 0; for (let i = k * h; i < k * h + w; i++) e += x[i] * x[i]; db[k] = 20 * Math.log10(Math.max(Math.sqrt(e / w), 1e-12)); }
  const sorted = Array.from(db).sort((a, b) => a - b); const p95 = sorted[Math.floor(0.95 * (n - 1))];
  const vals: number[] = []; let i = 0;
  while (i < n) { if (db[i] < p95 - 35) { let j = i; while (j < n && db[j] < p95 - 35) j++; if (j - i >= 25) for (let k = i + 5; k < j - 5; k++) vals.push(db[k]); i = j; } else i++; }
  if (!vals.length) return null; vals.sort((a, b) => a - b); const m = vals.length >> 1;
  return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
}

/** Exakt port av ffmpeg 8 af_alimiter.c (mono, level=disabled, latency=0), som serverns slutsteg:
 *  alimiter=limit=..:level=disabled:attack=1:release=80:asc=1 i 192 kHz. Används offline i prediktionen. */
export function alimiterOffline(x: Float32Array | Float64Array, sr: number, limit: number, attackMs = 1, releaseMs = 80, autoRelease = true): Float64Array {
  const release = releaseMs / 1000, bs = Math.trunc(sr * (attackMs / 1000));
  const buffer = new Float64Array(bs), nextpos = new Int32Array(bs).fill(-1), nextdelta = new Float64Array(bs);
  const y = new Float64Array(x.length), ascCoeff = Math.pow(0.5, 0.5 - 0.5) * 2 * -1;
  let pos = 0, att = 1, delta = 0, nextiter = 0, nextlen = 0, ascSum = 0, ascC = 0, ascPos = -1;
  const rd = (patt: number, asc: boolean) => {
    let r = (1 - patt) / (sr * release);
    if (asc && autoRelease && ascC > 0) { const a = limit / (ascCoeff * ascSum) * ascC; if (a > patt) { const d = Math.max((a - patt) / (sr * release), r / 10); if (d < r) r = d; } }
    return r;
  };
  for (let n = 0; n < x.length; n++) {
    const sample = x[n]; buffer[pos] = sample; let peak = Math.abs(sample);
    if (autoRelease && peak > limit) { ascSum += peak; ascC++; }
    if (peak > limit) {
      const patt = Math.min(limit / peak, 1), rdelta = rd(patt, false), d = (limit / peak - att) / bs;
      if (d < delta) { delta = d; nextpos[0] = pos; nextpos[1 % bs] = -1; nextdelta[0] = rdelta; nextlen = 1; nextiter = 0; }
      else {
        let found = false, i = nextiter;
        for (; i < nextiter + nextlen; i++) {
          const j = i % bs; let ppeak = 0;
          if (nextpos[j] >= 0) ppeak = Math.abs(buffer[nextpos[j]]);
          const pdelta = (limit / peak - limit / ppeak) / ((bs - nextpos[j] + pos) % bs);
          if (pdelta < nextdelta[j]) { nextdelta[j] = pdelta; found = true; break; }
        }
        if (found) { nextlen = i - nextiter + 1; nextpos[(nextiter + nextlen) % bs] = pos; nextdelta[(nextiter + nextlen) % bs] = rdelta; nextpos[(nextiter + nextlen + 1) % bs] = -1; nextlen++; }
      }
    }
    const bi = (pos + 1) % bs, b = buffer[bi]; peak = Math.abs(b);
    if (pos === ascPos) ascPos = -1;
    if (autoRelease && ascPos === -1 && peak > limit) { ascSum -= peak; ascC--; }
    att += delta; let out = b * att;
    if (bi === nextpos[nextiter]) {
      if (autoRelease) {
        delta = rd(att, true);
        if (nextlen > 1) { const pn = nextpos[(nextiter + 1) % bs]; const ppeak = Math.abs(buffer[pn]); const pdelta = (limit / ppeak - att) / ((bs + pn - bi) % bs); if (pdelta < delta) delta = pdelta; }
      } else { delta = nextdelta[nextiter]; att = limit / peak; }
      nextlen -= 1; nextpos[nextiter] = -1; nextiter = (nextiter + 1) % bs;
    }
    if (att > 1) { att = 1; delta = 0; nextiter = 0; nextlen = 0; nextpos[0] = -1; }
    if (att <= 0) { att = 0.0000000000001; delta = (1 - att) / (sr * release); }
    if (att !== 1 && (1 - att) < 0.0000000000001) att = 1;
    if (delta !== 0 && Math.abs(delta) < 0.00000000000001) delta = 0;
    out = Math.max(-limit, Math.min(limit, out));
    y[n] = out; pos = (pos + 1) % bs;
  }
  return y;
}

/** Förutsäger mastern med serverns låsta slutsteg (backend finalize): kedja (klang) -> gain -> pausexpander (48 kHz)
 *  -> 192 kHz -> alimiter (exakt port) -> mätning. Iterera gain som servern tills nivån ligger inom 0,03 LU.
 *  Pausbruset mäts efter expandern och läggs ihop med 16-bitars TPDF-dither (≈ −95 dBFS), som serverns slutfil. */
const DITHER_DB = -95.1;
export async function predict(buffer: AudioBuffer, p: Params, spec: Spec) {
  const sr = buffer.sampleRate, hi = 192000;
  const c0 = new OfflineAudioContext(1, buffer.length, sr); const s0 = c0.createBufferSource(); s0.buffer = buffer;
  const ch = buildChain(c0, p, 0, false); s0.connect(ch.input); ch.output.connect(c0.destination); s0.start();
  const base = (await c0.startRendering()).getChannelData(0);
  const ceil = dbToLin(Math.min(p.limiter.ceiling, spec.peak_max - 0.3));
  const run = async (gainDb: number) => {
    const g = dbToLin(gainDb), xg = new Float32Array(base.length); for (let i = 0; i < base.length; i++) xg[i] = base[i] * g;
    const ex = pauseExpander(xg, sr);
    const up = new OfflineAudioContext(1, Math.ceil(ex.length * hi / sr), hi); const b = up.createBuffer(1, ex.length, sr);
    b.copyToChannel(ex as Float32Array<ArrayBuffer>, 0); const s = up.createBufferSource(); s.buffer = b; s.connect(up.destination); s.start();
    const lim = alimiterOffline((await up.startRendering()).getChannelData(0), hi, ceil);
    let pk = 0; for (let i = 0; i < lim.length; i++) { const a = Math.abs(lim[i]); if (a > pk) pk = a; }
    const out32 = Float32Array.from(lim), n = pauseMedian(out32, hi); // brus mäts efter limitern, som serverns slutfil
    return { gain: gainDb, level: integratedLufs(out32, hi), tp: linToDb(pk), noise: n === null ? null : 10 * Math.log10(Math.pow(10, n / 10) + Math.pow(10, DITHER_DB / 10)) };
  };
  const iters: { gain: number; level: number; tp: number; noise: number | null }[] = [];
  let gain = spec.target - integratedLufs(base, sr), r = await run(gain); iters.push(r);
  for (let it = 0; it < 6 && Math.abs(spec.target - r.level) > 0.03; it++) {
    // sekantsteg (limitern gör att +1 dB gain ger mindre än +1 LU), annars rakt steg som servern
    const prev = iters.length > 1 ? iters[iters.length - 2] : null;
    const slope = prev && Math.abs(r.level - prev.level) > 1e-3 ? Math.max(0.2, Math.min(1.5, (r.level - prev.level) / (r.gain - prev.gain))) : 1;
    gain = r.gain + (spec.target - r.level) / slope; r = await run(gain); iters.push(r);
  }
  return { autoGainDb: r.gain, level: r.level, truePeak: r.tp, noise: r.noise, iters };
}
