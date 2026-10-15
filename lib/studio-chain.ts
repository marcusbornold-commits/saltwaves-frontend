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
export type Spec = { id: string; label: string; metric: "lufs" | "rms"; target: number; tolerance?: number; range?: [number, number]; peak_kind: "tp" | "sample"; peak_max: number; noise_max: number; note?: string };

const BUTTERWORTH_DB = -3.0103; // Web Audio: Q för low/highpass anges i dB
const PREDELAY = 0.006; // DynamicsCompressor lookahead i Chrome/Safari


const LIMITER_SRC = `class L extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:"ceiling",defaultValue:0.668,automationRate:"k-rate"}]}
constructor(){super();this.la=Math.round(sampleRate*0.005);this.N=this.la+1;this.M=this.N+4;this.buf=new Float32Array(this.N);this.w=0;this.t=0;this.qv=new Float32Array(this.M);this.qi=new Float64Array(this.M);this.h=0;this.e=0;this.g=1;this.rel=Math.exp(-1/(sampleRate*0.08));}
process(inp,out,p){const y=out[0][0];const x=inp[0]&&inp[0][0];const c=p.ceiling[0];for(let n=0;n<y.length;n++){const s=x?x[n]:0;const a=Math.abs(s);const v=a>c?c/a:1;this.t++;while(this.e>this.h&&this.qv[(this.e-1)%this.M]>=v)this.e--;this.qv[this.e%this.M]=v;this.qi[this.e%this.M]=this.t;this.e++;while(this.qi[this.h%this.M]<=this.t-this.N)this.h++;const d=this.qv[this.h%this.M];this.g=d<this.g?d:this.rel*this.g+(1-this.rel)*d;const r=(this.w+1)%this.N;this.buf[this.w]=s;y[n]=this.buf[r]*this.g;this.w=r;}for(let ch=1;ch<out[0].length;ch++)out[0][ch].set(y);return true}}
registerProcessor("sw-limiter",L);`;
let limiterUrl: string | null = null;
export async function loadLimiter(ctx: BaseAudioContext) {
  if (!limiterUrl) limiterUrl = URL.createObjectURL(new Blob([LIMITER_SRC], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(limiterUrl);
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
  let limiter: AudioWorkletNode | null = null;
  if (withLimiter) { limiter = new AudioWorkletNode(ctx, "sw-limiter"); autoGain.connect(limiter); output = limiter; }
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

/** Förutsäger mastern: rendera kedjan offline, sätt nivå till spec, rendera igen med limiter i 192 kHz (≈ true peak). */
export async function predict(buffer: AudioBuffer, p: Params, spec: Spec) {
  const sr = buffer.sampleRate;
  const pass1 = new OfflineAudioContext(1, buffer.length, sr);
  const s1 = pass1.createBufferSource(); s1.buffer = buffer;
  const c1 = buildChain(pass1, p, 0, false); s1.connect(c1.input); c1.output.connect(pass1.destination); s1.start();
  const r1 = (await pass1.startRendering()).getChannelData(0);
  const level1 = spec.metric === "lufs" ? integratedLufs(r1, sr) : rmsDb(r1);
  let gain = spec.target - level1;
  const hi = 192000, len = Math.ceil(buffer.length * hi / sr);
  let out: Float32Array = new Float32Array(0), level = level1;
  for (let it = 0; it < 2; it++) {
    const ctx = new OfflineAudioContext(1, len, hi); await loadLimiter(ctx);
    const s = ctx.createBufferSource(); s.buffer = buffer;
    const c = buildChain(ctx, p, gain, true); s.connect(c.input); c.output.connect(ctx.destination); s.start();
    out = (await ctx.startRendering()).getChannelData(0);
    level = spec.metric === "lufs" ? integratedLufs(out, hi) : rmsDb(out);
    const miss = spec.target - level; if (Math.abs(miss) < 0.1) break; gain += miss;
  }
  return { autoGainDb: gain, level, truePeak: peakDb(out) };
}
