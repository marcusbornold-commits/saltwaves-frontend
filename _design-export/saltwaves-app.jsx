// saltwaves-app.jsx — page assembly + Tweaks
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "hero": "Wave",
  "headline": "60 seconds",
  "motion": true,
  "currency": "Auto"
}/*EDITMODE-END*/;

const HEADLINES = {
  "60 seconds": "Master your podcast in 60 seconds.",
  "No studio": "Studio sound. No studio.",
};
const SUBLINE =
  "PodMaster cleans the noise, balances the EQ and matches loudness to broadcast spec — tuned by ears with 20 years behind the console.";

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Reveal-on-scroll (rect-based; no IntersectionObserver dependency)
  React.useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    let pending = els.filter((el) => !el.classList.contains("in"));
    const check = () => {
      if (!pending.length) return;
      const vh = window.innerHeight;
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) { el.classList.add("in"); return false; }
        return true;
      });
    };
    const raf = requestAnimationFrame(check);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [t.hero]);

  const headline = HEADLINES[t.headline] || HEADLINES["60 seconds"];
  const heroDark = t.hero === "Console";

  return (
    <React.Fragment>
      <a id="top"></a>
      <Nav dark={heroDark} />
      <main>
        {t.hero === "Split" && <HeroSplit headline={headline} subline={SUBLINE} />}
        {t.hero === "Wave" && <HeroWave headline={headline} subline={SUBLINE} motion={t.motion} />}
        {t.hero === "Console" && <HeroConsole headline={headline} subline={SUBLINE} />}
        <DemoSection />
        <HowItWorks />
        <ToolsSuite />
        <Credibility />
        <Pricing currency={t.currency} />
        <FAQ />
        <BlogTeaser />
        <FinalCTA />
      </main>
      <Footer />

      <TweaksPanel>
        <TweakSection label="Hero" />
        <TweakRadio label="Layout" value={t.hero} options={["Split", "Wave", "Console"]} onChange={(v) => setTweak("hero", v)} />
        <TweakRadio label="Headline" value={t.headline} options={["60 seconds", "No studio"]} onChange={(v) => setTweak("headline", v)} />
        <TweakSection label="Motion" />
        <TweakToggle label="Animate waveforms" value={t.motion} onChange={(v) => setTweak("motion", v)} />
        <TweakSection label="Pricing" />
        <TweakSelect label="Currency preview" value={t.currency} options={["Auto", "SEK", "NOK", "DKK", "EUR", "USD"]} onChange={(v) => setTweak("currency", v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
