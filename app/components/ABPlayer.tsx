"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AbPageConfig } from "@/lib/ab-pages";

type Slot = "A" | "B";

function fmtTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ABPlayer({ config }: { config: AbPageConfig }) {
  const audioA = useRef<HTMLAudioElement>(null);
  const audioB = useRef<HTMLAudioElement>(null);
  const raf = useRef<number>(0);

  const [slot, setSlot] = useState<Slot>("A");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const active = () => (slot === "A" ? audioA.current : audioB.current);
  const inactive = () => (slot === "A" ? audioB.current : audioA.current);

  const syncProgress = useCallback(() => {
    const el = active();
    if (el) setCurrent(el.currentTime);
    raf.current = requestAnimationFrame(syncProgress);
  }, [slot]);

  useEffect(() => {
    const a = audioA.current;
    const b = audioB.current;
    if (!a || !b) return;

    const onMeta = () => {
      const d = Math.max(a.duration || 0, b.duration || 0);
      if (isFinite(d) && d > 0) {
        setDuration(d);
        setReady(true);
      }
    };

    a.addEventListener("loadedmetadata", onMeta);
    b.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      b.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  useEffect(() => {
    if (playing) {
      raf.current = requestAnimationFrame(syncProgress);
    } else {
      cancelAnimationFrame(raf.current);
    }
    return () => cancelAnimationFrame(raf.current);
  }, [playing, syncProgress]);

  const pauseBoth = () => {
    audioA.current?.pause();
    audioB.current?.pause();
    setPlaying(false);
  };

  const togglePlay = useCallback(async () => {
    const el = active();
    if (!el) return;

    if (playing) {
      pauseBoth();
      return;
    }

    inactive()?.pause();
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [playing, slot]);

  const switchSlot = useCallback(
    async (next: Slot) => {
      if (next === slot) return;

      const from = active();
      const to = next === "A" ? audioA.current : audioB.current;
      if (!from || !to) return;

      const t = from.currentTime;
      const wasPlaying = playing;
      from.pause();

      to.currentTime = t;
      setSlot(next);
      setCurrent(t);

      if (wasPlaying) {
        try {
          await to.play();
          setPlaying(true);
        } catch {
          setPlaying(false);
        }
      }
    },
    [playing, slot]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "a" || e.key === "A") void switchSlot("A");
      if (e.key === "b" || e.key === "B") void switchSlot("B");
      if (e.key === " ") {
        e.preventDefault();
        void togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [switchSlot, togglePlay]);

  const seek = (t: number) => {
    const clamped = Math.max(0, Math.min(duration, t));
    if (audioA.current) audioA.current.currentTime = clamped;
    if (audioB.current) audioB.current.currentTime = clamped;
    setCurrent(clamped);
  };

  const onEnded = () => {
    setPlaying(false);
    setCurrent(0);
    if (audioA.current) audioA.current.currentTime = 0;
    if (audioB.current) audioB.current.currentTime = 0;
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="abp">
      <style>{CSS}</style>

      <audio
        ref={audioA}
        src={config.trackA.src}
        preload="auto"
        onEnded={slot === "A" ? onEnded : undefined}
      />
      <audio
        ref={audioB}
        src={config.trackB.src}
        preload="auto"
        onEnded={slot === "B" ? onEnded : undefined}
      />

      <header className="abp-head">
        {config.eyebrow && <p className="abp-eyebrow">{config.eyebrow}</p>}
        <h1 className="abp-title">{config.title}</h1>
        {config.subtitle && <p className="abp-sub">{config.subtitle}</p>}
      </header>

      <section className="abp-player" aria-label="A/B audio comparison">
        <div className="abp-slot-row" role="group" aria-label="Select track">
          {(["A", "B"] as Slot[]).map((s) => {
            const track = s === "A" ? config.trackA : config.trackB;
            const on = slot === s;
            return (
              <button
                key={s}
                type="button"
                className={`abp-slot abp-slot-${s}${on ? " is-active" : ""}`}
                aria-pressed={on}
                onClick={() => void switchSlot(s)}
              >
                <span className="abp-slot-tag">{track.label}</span>
                {track.hint && <span className="abp-slot-hint">{track.hint}</span>}
              </button>
            );
          })}
        </div>

        <div className="abp-controls">
          <button
            type="button"
            className="abp-play"
            onClick={() => void togglePlay()}
            disabled={!ready}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <rect x="4" y="3" width="4.5" height="14" rx="1" />
                <rect x="11.5" y="3" width="4.5" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M5 2.5v15c0 .9 1 1.4 1.7 1l11-7.5c.7-.5.7-1.5 0-2L6.7 1.5C6-.1 5 .4 5 1.3v1.2z" />
              </svg>
            )}
          </button>

          <div className="abp-timeline">
            <input
              type="range"
              className="abp-seek"
              min={0}
              max={duration || 100}
              step={0.05}
              value={current}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Playback position"
              disabled={!ready}
            />
            <div className="abp-times">
              <span>{fmtTime(current)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="abp-meter" aria-hidden>
          <div className="abp-meter-fill" style={{ width: `${pct}%` }} />
        </div>

        <p className="abp-note">
          Press <kbd>A</kbd> / <kbd>B</kbd> to switch while playing. Levels are as
          delivered — no level matching applied.
        </p>
      </section>

      <section className="abp-findings" aria-label="Analysis findings">
        <h2 className="abp-h2">Findings</h2>
        <ul className="abp-findings-list">
          {config.findings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const CSS = `
@import url("https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap");

.abp{
  --orange:#ff6200; --paper:#f1ede8; --ink:#1a1a1a;
  --ink-60:rgba(26,26,26,.6); --line:rgba(26,26,26,.16);
  background:var(--paper); color:var(--ink);
  min-height:100vh; padding:56px 24px 80px;
  font-family:'Archivo',system-ui,sans-serif;
}
.abp-head{max-width:720px;margin:0 auto 36px}
.abp-eyebrow{
  font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--orange);margin:0 0 10px;font-weight:600;
}
.abp-title{
  font-family:'Clash Display','Archivo',sans-serif;
  font-size:clamp(32px,5vw,52px);line-height:1.04;margin:0 0 12px;font-weight:600;
}
.abp-sub{color:var(--ink-60);line-height:1.55;margin:0;font-size:16px;max-width:560px}
.abp-player{
  max-width:720px;margin:0 auto 40px;
  background:rgba(255,255,255,.5);border:1px solid var(--line);
  border-radius:16px;padding:24px 22px 20px;
}
.abp-slot-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px}
.abp-slot{
  display:flex;flex-direction:column;align-items:flex-start;gap:4px;
  padding:14px 16px;border-radius:12px;border:1.5px solid var(--line);
  background:transparent;cursor:pointer;text-align:left;
  transition:border-color .15s,background .15s;
  font-family:inherit;color:inherit;
}
.abp-slot:hover{border-color:var(--ink)}
.abp-slot.is-active{background:rgba(255,255,255,.65)}
.abp-slot-A.is-active{border-color:var(--ink)}
.abp-slot-B.is-active{border-color:var(--orange)}
.abp-slot-tag{font-size:13px;font-weight:700;letter-spacing:.06em}
.abp-slot-B .abp-slot-tag{color:var(--orange)}
.abp-slot-hint{font-size:12px;color:var(--ink-60)}
.abp-controls{display:flex;align-items:center;gap:16px}
.abp-play{
  flex-shrink:0;width:52px;height:52px;border-radius:50%;border:0;
  background:var(--ink);color:var(--paper);cursor:pointer;
  display:grid;place-items:center;
  transition:transform .12s,opacity .12s;
}
.abp-play:hover:not(:disabled){transform:scale(1.04)}
.abp-play:disabled{opacity:.35;cursor:not-allowed}
.abp-timeline{flex:1;min-width:0}
.abp-seek{
  width:100%;height:6px;appearance:none;border-radius:999px;
  background:var(--line);cursor:pointer;display:block;margin-bottom:6px;
}
.abp-seek::-webkit-slider-thumb{
  appearance:none;width:14px;height:14px;border-radius:50%;
  background:var(--orange);border:2px solid var(--paper);
}
.abp-seek::-moz-range-thumb{
  width:14px;height:14px;border-radius:50%;
  background:var(--orange);border:2px solid var(--paper);
}
.abp-times{
  display:flex;justify-content:space-between;
  font-size:12px;color:var(--ink-60);font-variant-numeric:tabular-nums;
}
.abp-meter{
  height:3px;background:var(--line);border-radius:999px;
  margin:18px 0 14px;overflow:hidden;
}
.abp-meter-fill{height:100%;background:var(--orange);border-radius:999px;transition:width .08s linear}
.abp-note{font-size:13px;color:var(--ink-60);margin:0;line-height:1.5}
.abp-note kbd{
  font-family:inherit;font-size:12px;font-weight:700;
  padding:1px 6px;border-radius:4px;border:1px solid var(--line);
  background:rgba(255,255,255,.6);
}
.abp-findings{max-width:720px;margin:0 auto}
.abp-h2{
  font-family:'Clash Display','Archivo',sans-serif;
  font-size:20px;margin:0 0 14px;font-weight:600;
}
.abp-findings-list{
  margin:0;padding:0;list-style:none;display:grid;gap:10px;
}
.abp-findings-list li{
  position:relative;padding:12px 14px 12px 28px;
  border:1px solid var(--line);border-radius:10px;
  background:rgba(255,255,255,.5);font-size:14px;line-height:1.55;
}
.abp-findings-list li::before{
  content:"—";position:absolute;left:12px;top:12px;
  color:var(--orange);font-weight:700;
}
@media (prefers-reduced-motion:reduce){
  .abp-play,.abp-meter-fill{transition:none}
}
`;
