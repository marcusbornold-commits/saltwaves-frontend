// saltwaves-hero.jsx — three hero variants (switch via Tweaks)
const heroCommon = {
  ctaLabel: "Master your podcast in 60 seconds",
  micro: "Free · No account needed · .wav / .mp3",
};

function HeroCTA({ onTry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <a className="btn btn-primary" href="#try" style={{ fontSize: 17 }}>
        {heroCommon.ctaLabel}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9h12"></path><path d="M10 4l5 5-5 5"></path>
        </svg>
      </a>
      <span className="microcopy">{heroCommon.micro}</span>
    </div>
  );
}

/* ---------- Animated full-width waveform canvas ---------- */
function WaveCanvas({ motion, height = 170, dark }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx2 = canvas.getContext("2d");
    let raf = null;
    let phase = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = motion && !reduced;

    function draw() {
      const w = canvas.clientWidth;
      const h = height;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, w, h);
      const barW = 5, gap = 4;
      const n = Math.floor(w / (barW + gap));
      const mid = h / 2;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        let v =
          0.45 * Math.sin(t * 7.3 + phase) +
          0.3 * Math.sin(t * 17.1 - phase * 1.4) +
          0.22 * Math.sin(t * 41.7 + phase * 0.6);
        v = Math.abs(v);
        const env = Math.sin(t * Math.PI); // taper at edges
        const bh = Math.max(3, v * env * (h * 0.92));
        const x = i * (barW + gap);
        ctx2.fillStyle = "rgba(255, 98, 0, " + (0.35 + 0.65 * v).toFixed(2) + ")";
        ctx2.beginPath();
        ctx2.roundRect(x, mid - bh / 2, barW, bh, 2.5);
        ctx2.fill();
      }
      if (animate) { phase += 0.016; raf = requestAnimationFrame(draw); }
    }
    draw();
    const onResize = () => { if (!animate) draw(); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [motion, height, dark]);
  return <canvas ref={ref} style={{ width: "100%", height: height, display: "block" }} aria-hidden="true"></canvas>;
}

/* ---------- Variant A: Split — copy left, upload right ---------- */
function HeroSplit({ headline, subline }) {
  return (
    <section className="band" data-screen-label="Hero (Split)" style={{ paddingTop: "clamp(64px, 9vw, 110px)" }}>
      <div className="container" style={{ display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", gap: "clamp(32px, 5vw, 72px)", alignItems: "center" }}>
        <div className="reveal in">
          <div className="kicker">PodMaster — AI podcast mastering</div>
          <h1 style={{ fontSize: "clamp(2.7rem, 5.6vw, 4.4rem)", marginBottom: 20 }}>{headline}</h1>
          <p className="section-sub" style={{ marginBottom: 34 }}>{subline}</p>
          <HeroCTA />
        </div>
        <div className="reveal in reveal-d1" id="try">
          <UploadZone />
          <div style={{ marginTop: 22, opacity: 0.9 }}>
            <WaveBars n={64} seed={1.7} height={34} />
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 880px) { section[data-screen-label="Hero (Split)"] .container { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ---------- Variant B: Wave — centered over a big animated waveform ---------- */
function HeroWave({ headline, subline, motion }) {
  return (
    <section className="band" data-screen-label="Hero (Wave)" style={{ paddingTop: "clamp(56px, 8vw, 96px)", paddingBottom: "clamp(64px, 9vw, 110px)" }}>
      <div className="container" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="kicker" style={{ justifyContent: "center" }}>PodMaster — AI podcast mastering</div>
        <h1 style={{ fontSize: "clamp(2.8rem, 6.2vw, 5rem)", maxWidth: "16ch", marginBottom: 22 }}>{headline}</h1>
        <p className="section-sub" style={{ margin: "0 auto 36px" }}>{subline}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <a className="btn btn-primary" href="#try" style={{ fontSize: 17 }}>{heroCommon.ctaLabel}</a>
          <span className="microcopy">{heroCommon.micro}</span>
        </div>
      </div>
      <div style={{ margin: "clamp(28px, 4vw, 52px) 0" }}>
        <WaveCanvas motion={motion} height={170} />
      </div>
      <div className="container" id="try" style={{ maxWidth: 640 }}>
        <UploadZone />
      </div>
    </section>
  );
}

/* ---------- Variant C: Console — dark, VU-meter detail ---------- */
function HeroConsole({ headline, subline }) {
  return (
    <section className="band band-dark hero-console" data-screen-label="Hero (Console)" style={{ paddingTop: "clamp(64px, 9vw, 110px)" }}>
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "clamp(36px, 5vw, 64px)", gap: 24, flexWrap: "wrap" }}>
          <VUMeter lit={9} total={16} />
          <span className="microcopy" style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>input · −31 LUFS&nbsp;&nbsp;→&nbsp;&nbsp;output · −16 LUFS</span>
          <VUMeter lit={13} total={16} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", gap: "clamp(32px, 5vw, 72px)", alignItems: "center" }}>
          <div>
            <div className="kicker">PodMaster — AI podcast mastering</div>
            <h1 style={{ fontSize: "clamp(2.7rem, 5.6vw, 4.4rem)", marginBottom: 20 }}>{headline}</h1>
            <p className="section-sub" style={{ marginBottom: 34 }}>{subline}</p>
            <HeroCTA />
          </div>
          <div id="try">
            <UploadZone dark={true} />
            <div style={{ marginTop: 22, opacity: 0.85 }}>
              <WaveBars n={64} seed={2.4} height={34} color="rgba(241,237,232,0.5)" />
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 880px) { section[data-screen-label="Hero (Console)"] .container > div:last-child { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

Object.assign(window, { HeroSplit, HeroWave, HeroConsole, WaveCanvas });
