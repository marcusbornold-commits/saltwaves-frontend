'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Slot = 'A' | 'B';
type Band = { name: string; lo: number; hi: number; level_db: number | null; absolute_dbfs?: number | null };
export type SideAnalysis = {
  integrated_lufs?: number | null;
  true_peak_dbtp?: number | null;
  lra?: number | null;
  noise_floor_pause_median_dbfs?: number | null;
  spectrum_bands?: Band[];
};
export type AbAnalysis = { raw?: SideAnalysis; master?: SideAnalysis };

function fmt(v: number | null | undefined, digits = 1) {
  return v == null || !Number.isFinite(v) ? '–' : v.toFixed(digits).replace('.', ',');
}
function fmtTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function OpenDoorsAb({
  rawUrl, masterUrl, analysis,
}: { rawUrl: string; masterUrl: string; analysis?: AbAnalysis | null }) {
  const audioA = useRef<HTMLAudioElement>(null);
  const audioB = useRef<HTMLAudioElement>(null);
  const raf = useRef(0);
  const [slot, setSlot] = useState<Slot>('A');
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const active = () => (slot === 'A' ? audioA.current : audioB.current);

  const syncProgress = useCallback(() => {
    const el = active();
    if (el) setCurrent(el.currentTime);
    raf.current = requestAnimationFrame(syncProgress);
  }, [slot]);

  useEffect(() => {
    const a = audioA.current, b = audioB.current;
    if (!a || !b) return;
    const onMeta = () => {
      const d = Math.max(a.duration || 0, b.duration || 0);
      if (isFinite(d) && d > 0) { setDuration(d); setReady(true); }
    };
    a.addEventListener('loadedmetadata', onMeta);
    b.addEventListener('loadedmetadata', onMeta);
    return () => { a.removeEventListener('loadedmetadata', onMeta); b.removeEventListener('loadedmetadata', onMeta); };
  }, [rawUrl, masterUrl]);

  useEffect(() => {
    if (playing) raf.current = requestAnimationFrame(syncProgress);
    else cancelAnimationFrame(raf.current);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, syncProgress]);

  const togglePlay = useCallback(async () => {
    const el = active();
    if (!el) return;
    if (playing) { audioA.current?.pause(); audioB.current?.pause(); setPlaying(false); return; }
    (slot === 'A' ? audioB.current : audioA.current)?.pause();
    try { await el.play(); setPlaying(true); } catch { setPlaying(false); }
  }, [playing, slot]);

  const switchSlot = useCallback(async (next: Slot) => {
    if (next === slot) return;
    const from = active();
    const to = next === 'A' ? audioA.current : audioB.current;
    if (!from || !to) return;
    const t = from.currentTime, was = playing;
    from.pause();
    to.currentTime = t;
    setSlot(next);
    setCurrent(t);
    if (was) { try { await to.play(); setPlaying(true); } catch { setPlaying(false); } }
  }, [playing, slot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'a' || e.key === 'A') void switchSlot('A');
      if (e.key === 'b' || e.key === 'B') void switchSlot('B');
      if (e.key === ' ') { e.preventDefault(); void togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [switchSlot, togglePlay]);

  const seek = (t: number) => {
    const c = Math.max(0, Math.min(duration, t));
    if (audioA.current) audioA.current.currentTime = c;
    if (audioB.current) audioB.current.currentTime = c;
    setCurrent(c);
  };
  const onEnded = () => {
    setPlaying(false); setCurrent(0);
    if (audioA.current) audioA.current.currentTime = 0;
    if (audioB.current) audioB.current.currentTime = 0;
  };

  const raw = analysis?.raw, mas = analysis?.master;
  const metrics: { label: string; unit: string; get: (s?: SideAnalysis) => number | null | undefined; digits?: number }[] = [
    { label: 'Integrerad', unit: 'LUFS', get: s => s?.integrated_lufs, digits: 1 },
    { label: 'True peak', unit: 'dBTP', get: s => s?.true_peak_dbtp, digits: 1 },
    { label: 'Brusgolv i pauser', unit: 'dBFS', get: s => s?.noise_floor_pause_median_dbfs, digits: 1 },
    { label: 'LRA', unit: 'LU', get: s => s?.lra, digits: 1 },
  ];
  const bands = mas?.spectrum_bands?.length ? mas.spectrum_bands : raw?.spectrum_bands || [];

  return (
    <section aria-label="A/B-jämförelse">
      <audio ref={audioA} src={rawUrl} preload="auto" onEnded={slot === 'A' ? onEnded : undefined} />
      <audio ref={audioB} src={masterUrl} preload="auto" onEnded={slot === 'B' ? onEnded : undefined} />

      <div className="od-card" style={{ padding: 22 }}>
        <div className="abp-slot-row" role="group" aria-label="Välj version" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
          {(['A', 'B'] as Slot[]).map(s => {
            const on = slot === s;
            return (
              <button key={s} type="button" onClick={() => void switchSlot(s)} aria-pressed={on}
                className={`abp-slot${on ? ' is-active' : ''}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                  padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${on ? (s === 'B' ? '#ff6200' : '#1a1a1a') : 'rgba(26,26,26,.16)'}`,
                  background: on ? 'rgba(255,255,255,.8)' : 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', color: 'inherit',
                }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', color: s === 'B' ? '#ff6200' : 'inherit' }}>
                  {s === 'A' ? 'A · Rå summa' : 'B · Mastrad'}
                </span>
                <span className="od-muted">{s === 'A' ? 'Spåren summerade, nivåmatchade till −16 LUFS' : 'Efter mix och mastering till −16 LUFS'}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button type="button" onClick={() => void togglePlay()} disabled={!ready} aria-label={playing ? 'Pausa' : 'Spela'}
            style={{ flexShrink: 0, width: 52, height: 52, borderRadius: '50%', border: 0, background: '#1a1a1a', color: '#f1ede8', cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : .35 }}>
            {playing ? '❚❚' : '▶'}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input type="range" min={0} max={duration || 100} step={0.05} value={current} disabled={!ready}
              onChange={e => seek(Number(e.target.value))} aria-label="Position" style={{ width: '100%' }} />
            <div className="od-muted" style={{ display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
              <span>{fmtTime(current)}</span><span>{fmtTime(duration)}</span>
            </div>
          </div>
        </div>
        <p className="od-muted" style={{ margin: '14px 0 0' }}>
          Tryck <kbd>A</kbd> / <kbd>B</kbd> för att växla medan det spelas. Båda versionerna är nivåmatchade till −16 LUFS så jämförelsen blir rättvis.
        </p>
      </div>

      <h2 style={{ fontSize: 20, margin: '28px 0 12px' }}>Mätvärden</h2>
      <div className="od-metrics">
        {metrics.map(m => (
          <div key={m.label} className="od-metric">
            <p>{m.label}</p>
            <div className="pair">
              <span>A {fmt(m.get(raw), m.digits)} {m.unit}</span>
              <span>B {fmt(m.get(mas), m.digits)} {m.unit}</span>
            </div>
          </div>
        ))}
      </div>
      {bands.length > 0 && (
        <>
          <h2 style={{ fontSize: 20, margin: '8px 0 12px' }}>Spektrum per band</h2>
          <p className="od-muted" style={{ margin: '0 0 10px' }}>Nivå relativt talkärnan 250 Hz–4 kHz.</p>
          <div className="od-bands">
            {bands.map(band => {
              const a = raw?.spectrum_bands?.find(x => x.name === band.name || (x.lo === band.lo && x.hi === band.hi));
              const b = mas?.spectrum_bands?.find(x => x.name === band.name || (x.lo === band.lo && x.hi === band.hi)) || band;
              return (
                <div key={band.name} className="od-band">
                  <span>{band.name}</span>
                  <span>A {fmt(a?.level_db)} dB → B {fmt(b?.level_db)} dB</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
