"use client";
// saltwaves-app.jsx — page assembly
// Ported note: the dev-only Tweaks panel was excluded from this port.
// The values below are the TWEAK_DEFAULTS the design shipped with.
import React from "react";
import { HeroSplit, HeroWave, HeroConsole } from "./saltwaves-hero";
import { DemoSection, HowItWorks, Credibility, Pricing } from "./saltwaves-sections";
import { ToolsSuite, FAQ, BlogTeaser, FinalCTA } from "./saltwaves-sections2";

const TWEAK_DEFAULTS: any = {
  "hero": "Wave",
  "headline": "60 seconds",
  "motion": true,
  "currency": "Auto"
};

const HEADLINES: any = {
  "60 seconds": "Master your podcast in 60 seconds.",
  "No studio": "Studio sound. No studio.",
};
const SUBLINE =
  "PodMaster cleans the noise, balances the EQ and matches loudness to broadcast spec — tuned by ears with 20 years behind the console.";

export default function App() {
  const t = TWEAK_DEFAULTS;

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

  return (
    <React.Fragment>
      <a id="top"></a>
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
    </React.Fragment>
  );
}
