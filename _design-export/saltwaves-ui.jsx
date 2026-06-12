// saltwaves-ui.jsx — shared primitives: wordmark, upload zone, wave bars, VU meter, demo audio engine
const { useState, useEffect, useRef, useCallback } = React;

/* ---------- Brand wordmark ---------- */
function Wordmark({ dark }) {
  return (
    <a className="nav-brand" href="#top" aria-label="Saltwaves.studio home">
      <img src={dark ? "assets/emblem-paper.png" : "assets/emblem-ink.png"} alt="Saltwaves emblem" />
      <span>saltwaves<span style={{ color: "var(--orange)" }}>.studio</span></span>
    </a>
  );
}

/* ---------- Deterministic wave bar heights ---------- */
function barHeights(n, seed) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const v =
      0.42 +
      0.30 * Math.sin(t * Math.PI * 2.2 + seed) +
      0.18 * Math.sin(t * Math.PI * 9.1 + seed * 2.7) +
      0.10 * Math.sin(t * Math.PI * 23.7 + seed * 5.3);
    out.push(Math.min(1, Math.max(0.08, Math.abs(v))));
  }
  return out;
}

function WaveBars({ n = 48, seed = 1, playing = false, color, height = 56, flat = 1 }) {
  const heights = React.useMemo(() => barHeights(n, seed), [n, seed]);
  return (
    <div
      className={"wavebars" + (playing ? " playing" : "")}
      style={{ color: color || "var(--orange)", height: height }}
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            height: Math.round(h * height * flat) + "px",
            animationDelay: (i % 7) * 0.09 + "s",
            animationDuration: 0.6 + (i % 5) * 0.13 + "s",
          }}
        ></span>
      ))}
    </div>
  );
}

/* ---------- VU meter strip ---------- */
function VUMeter({ lit = 9, total = 14, live = true }) {
  return (
    <div className={"vu" + (live ? " live" : "")} aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <i key={i} className={i < lit ? (i >= lit - 2 ? "lit hot" : "lit") : ""}></i>
      ))}
    </div>
  );
}

/* ---------- Upload zone (functional; placeholder backend handler) ---------- */
function formatBytes(b) {
  if (b > 1048576) return (b / 1048576).toFixed(1) + " MB";
  if (b > 1024) return (b / 1024).toFixed(0) + " KB";
  return b + " B";
}

function UploadZone({ dark, compact }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | ready | working | queued
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const accept = (f) => {
    if (!f) return;
    if (!/\.(wav|mp3)$/i.test(f.name)) {
      setError("Only .wav or .mp3 for now — drop your episode export.");
      return;
    }
    setError(null);
    setFile(f);
    setStatus("ready");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const startMastering = (e) => {
    e.stopPropagation();
    // ── PLACEHOLDER HANDLER ─────────────────────────────────────────
    // Wire this to the FastAPI backend, e.g.:
    //   const form = new FormData(); form.append("file", file);
    //   await fetch("https://api.saltwaves.studio/master", { method: "POST", body: form });
    console.log("[PodMaster] startMastering()", { name: file.name, size: file.size });
    setStatus("working");
    setTimeout(() => setStatus("queued"), 1400);
  };

  const reset = (e) => {
    e.stopPropagation();
    setFile(null);
    setStatus("idle");
    setError(null);
  };

  return (
    <div
      className={"upload-zone" + (dark ? " dark" : "") + (dragging ? " dragging" : "")}
      style={compact ? { padding: "24px 22px" } : null}
      onClick={() => status === "idle" && inputRef.current && inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label="Upload your podcast audio file"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".wav,.mp3,audio/wav,audio/mpeg"
        style={{ display: "none" }}
        onChange={(e) => accept(e.target.files && e.target.files[0])}
      />

      {status === "idle" && (
        <div>
          <div className="upload-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 16V4"></path>
              <path d="M5.5 9.5 11 4l5.5 5.5"></path>
              <path d="M4 18.5h14"></path>
            </svg>
          </div>
          <div className="upload-title">{dragging ? "Drop it — let's listen." : "Drop your episode here"}</div>
          <div className="microcopy">.wav or .mp3 — or click to browse</div>
          {error && <div style={{ color: "var(--orange)", fontWeight: 500, fontSize: 14, marginTop: 12 }}>{error}</div>}
        </div>
      )}

      {status !== "idle" && file && (
        <div onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
          <div className="upload-file-row">
            <WaveBars n={9} seed={3.2} height={30} playing={status === "working"} />
            <div style={{ flex: 1 }}>
              <div className="upload-file-name">{file.name}</div>
              <div className="microcopy">{formatBytes(file.size)}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={reset} aria-label="Remove file" style={{ padding: "8px 12px" }}>✕</button>
          </div>

          {status === "ready" && (
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={startMastering}>
              Start mastering
            </button>
          )}
          {status === "working" && (
            <div className="microcopy" style={{ padding: "14px 0 4px" }}>Listening… measuring noise floor &amp; loudness</div>
          )}
          {status === "queued" && (
            <div style={{ fontWeight: 700, color: "var(--orange)", padding: "12px 0 2px", fontSize: 15 }}>
              ✓ Queued for mastering
              <div className="microcopy" style={{ fontWeight: 400, marginTop: 4 }}>demo only — backend hookup pending</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Synthesized before/after demo audio ----------
   Placeholder clips: a short plucked phrase rendered two ways.
   "raw"      = quiet, band-limited, noise bed + hum (untreated recording)
   "mastered" = full-range, EQ'd, compressed, loudness-matched
   Swap for real <audio> clips when available.                       */
const demoAudio = (() => {
  let ctx = null;
  let current = null; // { nodes: [], master, timer }

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function stop() {
    if (!current) return;
    const { nodes, master, timer } = current;
    clearTimeout(timer);
    const now = ctx.currentTime;
    try { master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(0, now, 0.04); } catch (e) {}
    setTimeout(() => {
      nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} });
      try { master.disconnect(); } catch (e) {}
    }, 120);
    current = null;
  }

  function play(kind, onEnd) {
    const ac = ensureCtx();
    stop();
    const t0 = ac.currentTime + 0.05;
    const dur = 5.6;
    const nodes = [];

    const master = ac.createGain();
    master.gain.value = kind === "mastered" ? 0.5 : 0.17;

    let chainIn = master;
    if (kind === "mastered") {
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -26; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
      const presence = ac.createBiquadFilter();
      presence.type = "peaking"; presence.frequency.value = 3200; presence.gain.value = 3.5; presence.Q.value = 0.9;
      chainIn = presence; presence.connect(comp); comp.connect(master);
    } else {
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 3400; lp.Q.value = 0.6;
      const hp = ac.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 240;
      chainIn = hp; hp.connect(lp); lp.connect(master);
    }
    master.connect(ac.destination);

    // Plucked phrase (same musical content both ways)
    const phrase = [220, 277.18, 329.63, 440, 369.99, 329.63, 277.18, 246.94, 220, 277.18, 329.63, 220];
    phrase.forEach((f, i) => {
      const start = t0 + i * 0.42;
      const osc = ac.createOscillator();
      osc.type = "triangle"; osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.8, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      osc.connect(g); g.connect(chainIn);
      osc.start(start); osc.stop(start + 0.6);
      nodes.push(osc);
    });

    // Low pad underneath
    const pad = ac.createOscillator();
    pad.type = "sine"; pad.frequency.value = 110;
    const padG = ac.createGain();
    padG.gain.setValueAtTime(0.0001, t0);
    padG.gain.exponentialRampToValueAtTime(0.16, t0 + 0.8);
    padG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    pad.connect(padG); padG.connect(chainIn);
    pad.start(t0); pad.stop(t0 + dur);
    nodes.push(pad);

    if (kind === "raw") {
      // Noise bed
      const len = Math.ceil(ac.sampleRate * 2);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * 0.5;
      const noise = ac.createBufferSource();
      noise.buffer = buf; noise.loop = true;
      const nFilt = ac.createBiquadFilter();
      nFilt.type = "lowpass"; nFilt.frequency.value = 5200;
      const nG = ac.createGain(); nG.gain.value = 0.16;
      noise.connect(nFilt); nFilt.connect(nG); nG.connect(master);
      noise.start(t0); noise.stop(t0 + dur);
      nodes.push(noise);
      // Mains hum
      const hum = ac.createOscillator();
      hum.type = "sawtooth"; hum.frequency.value = 60;
      const humG = ac.createGain(); humG.gain.value = 0.045;
      hum.connect(humG); humG.connect(master);
      hum.start(t0); hum.stop(t0 + dur);
      nodes.push(hum);
    }

    const timer = setTimeout(() => { current = null; onEnd && onEnd(); }, (dur + 0.2) * 1000);
    current = { nodes, master, timer };
  }

  return { play, stop };
})();

Object.assign(window, { Wordmark, WaveBars, VUMeter, UploadZone, demoAudio, barHeights });
