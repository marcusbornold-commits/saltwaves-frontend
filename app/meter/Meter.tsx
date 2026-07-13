"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  analyzeChannels,
  computeMomentaryLoudnessSeries,
  decodeFileTo48k,
  type AnalysisResult,
  type MomentaryLoudnessPoint,
} from "@/lib/audio-analysis";

type Mode = "before" | "after";

interface SlotData {
  name: string;
  blobUrl: string;
  result: AnalysisResult;
  momentary: MomentaryLoudnessPoint[];
}

const ACCEPT = ".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4,audio/x-m4a";
const TOP = -8;
const BOTTOM = -60;

const lufsToPct = (l: number) =>
  Math.max(0, Math.min(100, ((l - BOTTOM) / (TOP - BOTTOM)) * 100));

const fmtDb = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "–";
  return (v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
};

function lookupMomentary(series: MomentaryLoudnessPoint[], t: number): number {
  if (!series.length) return BOTTOM;
  if (t <= series[0].timeSec) return series[0].lufs;
  const last = series[series.length - 1];
  if (t >= last.timeSec) return last.lufs;
  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].timeSec <= t) lo = mid + 1;
    else hi = mid;
  }
  const a = series[lo - 1];
  const b = series[lo];
  const f = (t - a.timeSec) / (b.timeSec - a.timeSec);
  return a.lufs + (b.lufs - a.lufs) * f;
}

export default function Meter() {
  const [slots, setSlots] = useState<Partial<Record<Mode, SlotData>>>({});
  const [mode, setMode] = useState<Mode>("before");
  const [status, setStatus] = useState("");
  const [fillPct, setFillPct] = useState(0);
  const [showSafe, setShowSafe] = useState(false);
  const [showHook, setShowHook] = useState(true);
  const [showMatched, setShowMatched] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  const audioBeforeRef = useRef<HTMLAudioElement>(null);
  const audioAfterRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>("before");
  const inputBefore = useRef<HTMLInputElement>(null);
  const inputAfter = useRef<HTMLInputElement>(null);
  const blobUrls = useRef<string[]>([]);
  const boundUrl = useRef<Partial<Record<Mode, string>>>({});

  const active = slots[mode];

  const getPlaybackTime = useCallback(() => {
    const before = audioBeforeRef.current;
    const after = audioAfterRef.current;
    if (before && before.readyState >= 1 && isFinite(before.currentTime)) {
      return before.currentTime;
    }
    if (after && after.readyState >= 1 && isFinite(after.currentTime)) {
      return after.currentTime;
    }
    return 0;
  }, []);

  const applyAudibility = useCallback((m: Mode) => {
    const before = audioBeforeRef.current;
    const after = audioAfterRef.current;
    const both = Boolean(before?.src && after?.src);
    if (before) before.muted = both && m !== "before";
    if (after) after.muted = both && m !== "after";
  }, []);

  const syncSlaveToMaster = useCallback(() => {
    const before = audioBeforeRef.current;
    const after = audioAfterRef.current;
    if (!before || !after) return;
    if (before.readyState < 1 || after.readyState < 1) return;
    const m = modeRef.current;
    const master = m === "before" ? before : after;
    const slave = m === "before" ? after : before;
    if (Math.abs(slave.currentTime - master.currentTime) > 0.02) {
      slave.currentTime = master.currentTime;
    }
  }, []);

  const placeTicks = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const h = bar.clientHeight;
    const y = (l: number) => h * (1 - lufsToPct(l) / 100);
    const t16 = bar.querySelector<HTMLElement>("[data-tick='16']");
    const t23 = bar.querySelector<HTMLElement>("[data-tick='23']");
    const t36 = bar.querySelector<HTMLElement>("[data-tick='36']");
    const bracket = bar.querySelector<HTMLElement>("[data-bracket]");
    if (t16) t16.style.top = `${y(-16)}px`;
    if (t23) t23.style.top = `${y(-23)}px`;
    if (t36) t36.style.top = `${y(-36)}px`;
    if (bracket) {
      bracket.style.top = `${y(-14)}px`;
      bracket.style.height = `${y(-18) - y(-14)}px`;
    }
  }, []);

  useLayoutEffect(() => {
    placeTicks();
    const bar = barRef.current;
    if (!bar) return;
    const ro = new ResizeObserver(placeTicks);
    ro.observe(bar);
    window.addEventListener("resize", placeTicks);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", placeTicks);
    };
  }, [placeTicks]);

  const bindAudioSrc = useCallback(
    (target: Mode, el: HTMLAudioElement | null, slot: SlotData | undefined) => {
      if (!el) return;
      if (!slot) {
        boundUrl.current[target] = undefined;
        el.removeAttribute("src");
        el.load();
        return;
      }
      if (boundUrl.current[target] === slot.blobUrl) return;
      boundUrl.current[target] = slot.blobUrl;
      const t = getPlaybackTime();
      el.src = slot.blobUrl;
      el.onloadedmetadata = () => {
        el.currentTime = Math.min(t, el.duration || t);
        el.onloadedmetadata = null;
        syncSlaveToMaster();
        applyAudibility(modeRef.current);
      };
      el.load();
    },
    [getPlaybackTime, syncSlaveToMaster, applyAudibility]
  );

  useEffect(() => {
    bindAudioSrc("before", audioBeforeRef.current, slots.before);
  }, [slots.before, bindAudioSrc]);

  useEffect(() => {
    bindAudioSrc("after", audioAfterRef.current, slots.after);
  }, [slots.after, bindAudioSrc]);

  useEffect(() => {
    modeRef.current = mode;
    applyAudibility(mode);
  }, [mode, applyAudibility]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(syncSlaveToMaster, 400);
    return () => window.clearInterval(id);
  }, [playing, syncSlaveToMaster]);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const audio =
        modeRef.current === "before"
          ? audioBeforeRef.current
          : audioAfterRef.current;
      const slot = slots[modeRef.current];
      if (audio && slot?.momentary.length) {
        setFillPct(lufsToPct(lookupMomentary(slot.momentary, audio.currentTime)));
      } else if (slot?.result) {
        setFillPct(lufsToPct(slot.result.integratedLufs));
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [slots]);

  useEffect(() => {
    return () => {
      blobUrls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const loadFile = useCallback(async (target: Mode, file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext && !["wav", "mp3", "m4a"].includes(ext)) {
      setStatus("Unsupported format — use WAV, MP3, or M4A.");
      return;
    }

    setStatus(`Analyzing ${target === "before" ? "Before" : "After"}…`);
    try {
      const blobUrl = URL.createObjectURL(file);
      blobUrls.current.push(blobUrl);
      const channels = await decodeFileTo48k(file);
      const [result, momentary] = await Promise.all([
        analyzeChannels(channels),
        computeMomentaryLoudnessSeries(channels),
      ]);
      let firstLoad = false;
      setSlots((s) => {
        firstLoad = !s.before && !s.after;
        const prev = s[target];
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return {
          ...s,
          [target]: { name: file.name, blobUrl, result, momentary },
        };
      });
      if (firstLoad) setMode(target);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus(
        e instanceof Error && e.name === "EncodingError"
          ? "Could not decode this file."
          : "Analysis failed."
      );
    }
  }, []);

  const onFilePick = (target: Mode) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void loadFile(target, f);
    e.target.value = "";
  };

  const onDrop = (target: Mode) => (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void loadFile(target, f);
  };

  const switchMode = useCallback(
    (next: Mode) => {
      if (next === modeRef.current) return;
      syncSlaveToMaster();
      setMode(next);
    },
    [syncSlaveToMaster]
  );

  const toggleMode = useCallback(() => {
    switchMode(modeRef.current === "before" ? "after" : "before");
  }, [switchMode]);

  const getDuration = useCallback(() => {
    const before = audioBeforeRef.current;
    const after = audioAfterRef.current;
    let d = 0;
    if (before?.src && isFinite(before.duration)) d = Math.max(d, before.duration);
    if (after?.src && isFinite(after.duration)) d = Math.max(d, after.duration);
    return d;
  }, []);

  const isAtEnd = useCallback(() => {
    const d = getDuration();
    return d > 0 && getPlaybackTime() >= d - 0.05;
  }, [getDuration, getPlaybackTime]);

  const seekBoth = useCallback((t: number) => {
    const before = audioBeforeRef.current;
    const after = audioAfterRef.current;
    if (before && before.readyState >= 1) before.currentTime = t;
    if (after && after.readyState >= 1) after.currentTime = t;
    if (t < 0.05) setEnded(false);
  }, []);

  const pauseBoth = useCallback(() => {
    audioBeforeRef.current?.pause();
    audioAfterRef.current?.pause();
    setPlaying(false);
  }, []);

  const handleEnded = useCallback(() => {
    pauseBoth();
    setEnded(true);
  }, [pauseBoth]);

  const playBoth = useCallback(async () => {
    const before = audioBeforeRef.current;
    const after = audioAfterRef.current;
    const hasBefore = Boolean(slots.before);
    const hasAfter = Boolean(slots.after);
    if (!hasBefore && !hasAfter) return;

    setEnded(false);
    let t = getPlaybackTime();
    if (isAtEnd()) t = 0;

    const starters: Promise<void>[] = [];

    if (hasBefore && before) {
      if (before.readyState >= 1) before.currentTime = t;
      starters.push(
        before.play().then(
          () => undefined,
          () => undefined
        )
      );
    }
    if (hasAfter && after) {
      if (after.readyState >= 1) after.currentTime = t;
      starters.push(
        after.play().then(
          () => undefined,
          () => undefined
        )
      );
    }

    await Promise.all(starters);
    applyAudibility(modeRef.current);
    syncSlaveToMaster();

    const anyPlaying =
      (before && !before.paused) || (after && !after.paused);
    setPlaying(Boolean(anyPlaying));
  }, [slots.before, slots.after, getPlaybackTime, isAtEnd, applyAudibility, syncSlaveToMaster]);

  const restartFromTop = useCallback(() => {
    if (!slots.before && !slots.after) return;
    seekBoth(0);
    void playBoth();
  }, [slots.before, slots.after, seekBoth, playBoth]);

  const togglePlay = useCallback(() => {
    const before = audioBeforeRef.current;
    const after = audioAfterRef.current;
    const anyPlaying =
      (before && !before.paused) || (after && !after.paused);
    if (anyPlaying) pauseBoth();
    else void playBoth();
  }, [pauseBoth, playBoth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        toggleMode();
      }
      if (e.key === "s" || e.key === "S") setShowSafe((v) => !v);
      if (e.key === "h" || e.key === "H") setShowHook((v) => !v);
      if (e.key === "m" || e.key === "M") setShowMatched((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleMode]);

  const onPageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const target: Mode = !slots.before ? "before" : !slots.after ? "after" : mode;
    void loadFile(target, f);
  };

  return (
    <div className="meter-root" onDragOver={(e) => e.preventDefault()} onDrop={onPageDrop}>
      <style>{CSS}</style>

      <div className="stage">
        {showHook && (
          <div className="hook">
            Recorded at home.
            <br />
            <em>Sounds like it.</em>
            <span className="sub">🎧 Sound on</span>
          </div>
        )}

        {showMatched && <div className="matched-badge">MATCHED AT −16 LUFS</div>}

        <div className="ab">
          <span
            className={mode === "before" ? "on" : "off"}
            onClick={() => switchMode("before")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && switchMode("before")}
          >
            Before
          </span>
          <span className="slash">/</span>
          <span
            className={mode === "after" ? "on" : "off"}
            onClick={() => switchMode("after")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && switchMode("after")}
          >
            After
          </span>
        </div>

        <div className="meterwrap">
          <div className="bar" ref={barRef}>
            <div className="track">
              <div className="fill" style={{ height: `${fillPct}%` }} />
            </div>
            <div className="bracket" data-bracket />
            <div className="ticklbl hot" data-tick="16">
              −16
            </div>
            <div className="ticklbl" data-tick="23">
              −23
            </div>
            <div className="ticklbl" data-tick="36">
              −36
            </div>
          </div>
          <div className="readout">
            <div className="big">
              <div className="num">{fmtDb(active?.result.integratedLufs)}</div>
              <div className="unit">LUFS integrated</div>
            </div>
            <div className="small">
              <div className="num">{fmtDb(active?.result.truePeakDb)}</div>
              <div className="unit">dB true peak</div>
            </div>
          </div>
        </div>

        <div className={`safe${showSafe ? " show" : ""}`}>
          <div className="zone bottom" />
          <div className="zone right" />
          <span className="lbl b">IG caption zone</span>
          <span className="lbl r">IG buttons</span>
        </div>
      </div>

      <div className="panel">
        <h2>Meter</h2>
        <p>
          Drop WAV / MP3 / M4A onto the page. Analysis runs locally via{" "}
          <code>lib/audio-analysis.ts</code> — nothing is uploaded.
        </p>

        <button type="button" onClick={() => inputBefore.current?.click()}>
          Load Before (A)
          {slots.before ? ` — ${slots.before.name}` : ""}
        </button>
        <input
          ref={inputBefore}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={onFilePick("before")}
        />

        <button type="button" onClick={() => inputAfter.current?.click()}>
          Load After (B)
          {slots.after ? ` — ${slots.after.name}` : ""}
        </button>
        <input
          ref={inputAfter}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={onFilePick("after")}
        />

        <div
          className="drop-hint"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop(mode)}
        >
          Or drop a file here → loads into{" "}
          {mode === "before" ? "Before" : "After"}
        </div>

        <button type="button" onClick={togglePlay} disabled={!slots.before && !slots.after}>
          {playing ? "Pause" : ended ? "Play again" : "Play"}{" "}
          <span className="key">[Space]</span>
        </button>

        <button
          type="button"
          onClick={restartFromTop}
          disabled={!slots.before && !slots.after}
        >
          From the top
        </button>

        <button type="button" onClick={() => setShowSafe((v) => !v)}>
          IG safe zones <span className="key">[S]</span>
        </button>

        <button type="button" onClick={() => setShowHook((v) => !v)}>
          {showHook ? "Hide" : "Show"} hook text <span className="key">[H]</span>
        </button>

        <button type="button" onClick={() => setShowMatched((v) => !v)}>
          {showMatched ? "Hide" : "Show"} matched badge{" "}
          <span className="key">[M]</span>
        </button>

        {status && <p className="status">{status}</p>}
        <p className="hint">
          Both files play in sync — Before/After switches audio instantly at the
          same position. Toggle with <span className="key">[B]</span> or click
          in the frame. Record the 9:16 stage for Reels.
        </p>
      </div>

      <audio ref={audioBeforeRef} preload="auto" hidden onEnded={handleEnded} />
      <audio ref={audioAfterRef} preload="auto" hidden onEnded={handleEnded} />
    </div>
  );
}

const CSS = `
@import url("https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap");

:root{
  --bg:#141312;
  --panel:#1d1b19;
  --track:#26231f;
  --ink:#f3efe8;
  --muted:#8b857c;
  --orange:#FF6200;
  --orange-dim:#b34500;
}

.meter-root{
  background:#0b0a09;
  font-family:'Archivo',sans-serif;
  color:var(--ink);
  display:flex;align-items:center;justify-content:center;
  min-height:100vh;padding:24px;gap:28px;flex-wrap:wrap;
}

.stage{
  position:relative;
  width:min(405px, 92vw);
  aspect-ratio:9/16;
  background:var(--bg);
  border-radius:8px;
  overflow:hidden;
  display:flex;flex-direction:column;
  padding:7% 8% 0;
  container-type:inline-size;
}

.hook{
  margin-top:4%;
  font-family:'Clash Display',sans-serif;
  font-weight:600;
  font-size:clamp(20px,6.2cqw,30px);
  line-height:1.15;
  letter-spacing:.005em;
}
.hook em{font-style:normal;color:var(--orange)}
.hook .sub{
  display:block;margin-top:10px;
  font-family:'Archivo',sans-serif;font-weight:500;
  font-size:clamp(11px,3.4cqw,14px);color:var(--muted);letter-spacing:.02em;
}

.matched-badge{
  position:absolute;top:5%;right:8%;z-index:2;
  font-family:'Archivo',sans-serif;font-weight:700;font-size:9px;
  letter-spacing:.12em;text-transform:uppercase;
  color:var(--orange);background:rgba(255,98,0,.12);
  border:1px solid rgba(255,98,0,.45);
  border-radius:4px;padding:6px 8px;
}

.ab{
  margin-top:7%;
  display:flex;align-items:baseline;gap:14px;
  font-family:'Clash Display',sans-serif;font-weight:700;
  text-transform:uppercase;letter-spacing:.04em;
  user-select:none;
}
.ab span{transition:color .18s ease, transform .18s ease; cursor:pointer}
.ab .off{color:var(--muted);font-size:clamp(16px,5cqw,24px)}
.ab .on{color:var(--orange);font-size:clamp(30px,10cqw,48px);line-height:1}
.ab .slash{color:var(--muted);font-size:clamp(16px,5cqw,24px)}

.meterwrap{
  margin-top:6%;
  flex:1;
  display:grid;
  grid-template-columns: 88px 1fr;
  gap:8%;
  align-items:stretch;
  padding-bottom:24%;
}

.bar{
  position:relative;
  display:flex;justify-content:center;
}
.track{
  position:relative;width:34px;height:100%;
  background:var(--track);border-radius:17px;overflow:hidden;
}
.fill{
  position:absolute;left:0;right:0;bottom:0;
  background:linear-gradient(to top, var(--orange-dim), var(--orange));
  border-radius:0 0 17px 17px;
  transition:height .12s linear;
}
.bracket{
  position:absolute;left:-14px;right:-14px;
  border:2px solid var(--ink);border-top-width:2px;border-bottom-width:2px;
  border-left:none;border-right:none;opacity:.85;
  pointer-events:none;
}
.bracket::before,.bracket::after{
  content:"";position:absolute;top:-2px;bottom:-2px;width:8px;
  border:2px solid var(--ink);
}
.bracket::before{left:0;border-right:none}
.bracket::after{right:0;border-left:none}
.ticklbl{
  position:absolute;right:calc(100% + 20px);
  transform:translateY(-50%);
  font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.03em;
  white-space:nowrap;
}
.ticklbl.hot{color:var(--orange)}

.readout{display:flex;flex-direction:column;justify-content:flex-start;gap:8%}
.big .num{
  font-family:'Clash Display',sans-serif;font-weight:700;
  font-size:clamp(44px,15cqw,72px);line-height:.95;letter-spacing:-.01em;
  font-variant-numeric:tabular-nums;
}
.big .unit{
  font-family:'Archivo',sans-serif;font-weight:600;
  font-size:clamp(13px,3.6cqw,16px);color:var(--muted);
  letter-spacing:.14em;margin-top:6px;text-transform:uppercase;
}
.small{margin-top:4%}
.small .num{
  font-family:'Clash Display',sans-serif;font-weight:600;
  font-size:clamp(22px,7cqw,32px);line-height:1;
  font-variant-numeric:tabular-nums;color:var(--ink);
}
.small .unit{
  font-size:clamp(10px,2.8cqw,12px);color:var(--muted);
  letter-spacing:.14em;margin-top:4px;text-transform:uppercase;font-weight:600;
}

.safe{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .2s}
.safe.show{opacity:1}
.safe .zone{position:absolute;background:rgba(255,98,0,.10);border:1px dashed rgba(255,98,0,.5)}
.safe .bottom{left:0;right:0;bottom:0;height:22%}
.safe .right{top:40%;bottom:22%;right:0;width:14%}
.safe .lbl{
  position:absolute;font-size:9px;letter-spacing:.1em;color:var(--orange);
  text-transform:uppercase;font-weight:700;
}
.safe .lbl.b{bottom:calc(22% + 6px);left:12px}
.safe .lbl.r{top:calc(40% - 16px);right:12px}

.panel{
  width:260px;background:var(--panel);border-radius:10px;padding:20px;
  display:flex;flex-direction:column;gap:14px;
}
.panel h2{font-family:'Clash Display',sans-serif;font-weight:600;font-size:16px;margin:0}
.panel p{font-size:12px;color:var(--muted);line-height:1.5;margin:0}
.panel button{
  font-family:'Archivo',sans-serif;font-weight:600;font-size:13px;
  background:var(--track);border:1px solid #35312c;color:var(--ink);
  border-radius:8px;padding:10px 12px;cursor:pointer;text-align:left;
}
.panel button:hover:not(:disabled){border-color:var(--orange)}
.panel button:disabled{opacity:.45;cursor:not-allowed}
.panel button:focus-visible{outline:2px solid var(--orange);outline-offset:2px}
.panel .key{color:var(--orange);font-weight:700}
.panel code{font-size:11px;color:var(--ink)}
.drop-hint{
  font-size:11px;color:var(--muted);border:1px dashed #35312c;
  border-radius:8px;padding:10px 12px;line-height:1.4;
}
.status{color:var(--orange);font-size:12px;font-weight:600}
.hint{font-size:11px}

@media (prefers-reduced-motion: reduce){
  .fill{transition:none}
}
`;
