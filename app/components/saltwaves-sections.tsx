"use client";
// saltwaves-sections.jsx — nav, demo, how-it-works, credibility, pricing, footer
import React from "react";
import { Wordmark, WaveBars, VUMeter, demoAudio } from "./saltwaves-ui";

const navItems = [
  { href: "/#demo", label: "Hear it" },
  { href: "/services", label: "How it works" },
  { href: "/#tools", label: "Tools" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Nav({ dark }: any) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className={"nav" + (dark ? " nav-dark" : "")} data-screen-label="Navbar">
      <div className="container nav-inner">
        <Wordmark dark={dark} href="/" />
        <nav aria-label="Main">
          <ul className="nav-links">
            {navItems.map((item) => (
              <li key={item.href}><a href={item.href}>{item.label}</a></li>
            ))}
          </ul>
        </nav>
        <div className="nav-actions">
          <a className="btn btn-primary btn-sm" href="/login">Log in</a>
          <button
            type="button"
            className="nav-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="nav-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? (
                <>
                  <path d="M5 5l12 12"></path>
                  <path d="M17 5L5 17"></path>
                </>
              ) : (
                <>
                  <path d="M3 6h16"></path>
                  <path d="M3 11h16"></path>
                  <path d="M3 16h16"></path>
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
      <nav
        id="nav-mobile-menu"
        className={"nav-mobile-menu" + (menuOpen ? " is-open" : "")}
        aria-label="Mobile"
        hidden={!menuOpen}
      >
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <a href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
            </li>
          ))}
          <li>
            <a className="text-ink hover:text-orange" href="/login" onClick={() => setMenuOpen(false)}>Log in</a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

/* ---------- Before / after demo ---------- */
function DemoCard({ kind, playing, onToggle }: any) {
  const mastered = kind === "mastered";
  return (
    <article className={"demo-card" + (mastered ? " is-mastered" : "")}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 22 }}>
        <button
          className={"play-btn " + (mastered ? "play-mastered" : "play-raw")}
          onClick={onToggle}
          aria-label={(playing ? "Stop" : "Play") + " " + (mastered ? "mastered" : "raw") + " demo clip"}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="4.5" height="12" rx="1"></rect>
              <rect x="10.5" y="3" width="4.5" height="12" rx="1"></rect>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M4.5 2.8v12.4c0 .8.9 1.3 1.6.9l10-6.2c.7-.4.7-1.4 0-1.8l-10-6.2c-.7-.4-1.6.1-1.6.9z"></path>
            </svg>
          )}
        </button>
        <div>
          <h3 style={{ fontSize: 21 }}>{mastered ? "After — PodMaster" : "Before — raw recording"}</h3>
          <span className="microcopy">{mastered ? "one pass, 60 seconds" : "straight off the mic"}</span>
        </div>
      </div>
      <WaveBars
        n={56}
        seed={mastered ? 4.1 : 8.6}
        height={64}
        playing={playing}
        flat={mastered ? 1 : 0.45}
        color={mastered ? "var(--orange)" : "rgba(241,237,232,0.45)"}
      />
      <div className="demo-tags">
        {(mastered
          ? ["noise removed", "EQ balanced", "−16 LUFS"]
          : ["room noise", "uneven levels", "−31 LUFS"]
        ).map((t) => (
          <span className="demo-tag" key={t}>{t}</span>
        ))}
      </div>
    </article>
  );
}

export function DemoSection() {
  const [playing, setPlaying] = React.useState<any>(null); // null | 'raw' | 'mastered'
  const toggle = (kind: any) => {
    if (playing === kind) {
      demoAudio.stop();
      setPlaying(null);
    } else {
      demoAudio.play(kind, () => setPlaying(null));
      setPlaying(kind);
    }
  };
  React.useEffect(() => () => demoAudio.stop(), []);
  return (
    <section className="band band-dark" id="demo" data-screen-label="Before/After demo">
      <div className="container">
        <div className="reveal">
          <div className="kicker">Same file. 60 seconds apart.</div>
          <h2 className="section-title">Hear the difference.</h2>
          <p className="section-sub">No upload required — just press play.</p>
        </div>
        <div className="demo-grid">
          <div className="reveal reveal-d1"><DemoCard kind="raw" playing={playing === "raw"} onToggle={() => toggle("raw")} /></div>
          <div className="reveal reveal-d2"><DemoCard kind="mastered" playing={playing === "mastered"} onToggle={() => toggle("mastered")} /></div>
        </div>
        <p className="microcopy reveal reveal-d3" style={{ marginTop: 26 }}>
          synthesized placeholder clips — swap in real episode audio before launch
        </p>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */
function StepIcon({ kind }: any) {
  const common: any = { width: 40, height: 40, viewBox: "0 0 40 40", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "upload")
    return (
      <svg {...common} aria-hidden="true">
        <path d="M20 27V8"></path>
        <path d="M12 16l8-8 8 8"></path>
        <path d="M7 33h26"></path>
      </svg>
    );
  if (kind === "process")
    return (
      <svg {...common} aria-hidden="true">
        <path d="M8 12h24"></path><circle cx="16" cy="12" r="3.5" fill="var(--paper)"></circle>
        <path d="M8 20h24"></path><circle cx="26" cy="20" r="3.5" fill="var(--paper)"></circle>
        <path d="M8 28h24"></path><circle cx="13" cy="28" r="3.5" fill="var(--paper)"></circle>
      </svg>
    );
  return (
    <svg {...common} aria-hidden="true">
      <path d="M20 8v19"></path>
      <path d="M12 19l8 8 8-8"></path>
      <path d="M7 33h26"></path>
    </svg>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: "upload", title: "Upload", body: "Drop your episode export — .wav or .mp3, any length." },
    { icon: "process", title: "AI processing", body: "Noise reduction, EQ balance, loudness to broadcast spec." },
    { icon: "download", title: "Download", body: "Broadcast-ready audio in your inbox." },
  ];
  return (
    <section className="band" id="how" data-screen-label="How it works">
      <div className="container">
        <div className="reveal">
          <div className="kicker">How it works</div>
          <h2 className="section-title">Three steps. No session files.</h2>
        </div>
        <div className="steps-grid">
          {steps.map((s, i) => (
            <article className={"step-card reveal reveal-d" + (i + 1)} key={s.title}>
              <div className="step-num">0{i + 1}</div>
              <div className="step-icon"><StepIcon kind={s.icon} /></div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Credibility + testimonials ---------- */
const TESTIMONIALS = [
  { quote: "Placeholder — beta feedback goes here. A line or two about how the show finally sounds like a real production.", who: "Beta tester · show name" },
  { quote: "Placeholder — beta feedback goes here. Something specific: noise floor, loudness, the time it saved.", who: "Beta tester · show name" },
  { quote: "Placeholder — beta feedback goes here. Why they stopped fiddling with plugins and just upload now.", who: "Beta tester · show name" },
];

export function Credibility() {
  return (
    <section className="band band-dark" id="about" data-screen-label="Credibility">
      <div className="container">
        <div className="reveal" style={{ display: "grid", gridTemplateColumns: "minmax(0, 8fr) minmax(0, 4fr)", gap: "clamp(32px, 5vw, 64px)", alignItems: "center" }} data-cred-grid="true">
          <div>
            <p className="cred-quote">
              Built by a sound engineer with 20 years behind the console — <em>not scraped data.</em>
            </p>
            <p className="section-sub" style={{ marginTop: 22 }}>
              Live sound. Broadcast. TV. Streaming. That experience is baked into every decision the AI makes.
            </p>
            <div className="cred-meta">
              <span className="cred-chip">FOH · live sound</span>
              <span className="cred-chip">Broadcast</span>
              <span className="cred-chip">TV post</span>
              <span className="cred-chip">Streaming</span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 14, justifyContent: "start" }}>
            <VUMeter lit={11} total={16} />
            <VUMeter lit={8} total={16} />
            <VUMeter lit={13} total={16} />
          </div>
        </div>
        <div className="testi-grid" data-status="hidden">
          {TESTIMONIALS.map((t, i) => (
            <article className={"testi-card reveal reveal-d" + (i + 1)} key={i}>
              <p className="testi-quote">“{t.quote}”</p>
              <div className="testi-who">
                <span className="testi-avatar">IMG</span>
                <span className="microcopy">{t.who}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 760px) { section[data-screen-label="Credibility"] [data-cred-grid] { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

/* ---------- Pricing ---------- */
/* Static locale → currency mapping via navigator.language.
   No API calls — replace with Stripe's currency handling post-launch. */
const PRICE_TABLE: any = {
  SEK: { free: "0 kr", creator: ["199 kr", "1 990 kr"], studio: ["399 kr", "3 990 kr"] },
  NOK: { free: "0 kr", creator: ["219 kr", "2 190 kr"], studio: ["429 kr", "4 290 kr"] },
  DKK: { free: "0 kr", creator: ["139 kr", "1 390 kr"], studio: ["279 kr", "2 790 kr"] },
  EUR: { free: "€0", creator: ["€18", "€179"], studio: ["€36", "€359"] },
  USD: { free: "$0", creator: ["$19", "$190"], studio: ["$39", "$390"] },
};
const EU_LANGS = ["de", "fr", "es", "it", "nl", "pl", "fi", "pt", "el", "cs", "sk", "sl", "hr", "hu", "ro", "bg", "et", "lv", "lt", "mt", "ga"];

function detectCurrency() {
  const lang = (navigator.language || "en").toLowerCase().split("-")[0];
  if (lang === "sv") return "SEK";                                   // Sweden
  if (lang === "nb" || lang === "nn" || lang === "no") return "NOK"; // Norway
  if (lang === "da") return "DKK";                                   // Denmark
  if (EU_LANGS.includes(lang)) return "EUR";                         // EU incl. Finland
  return "USD";                                                      // everyone else incl. Iceland
}

export function Pricing({ currency }: any) {
  const [annual, setAnnual] = React.useState(true);
  // navigator is unavailable during server rendering, so resolve after mount
  const [cur, setCur] = React.useState("USD");
  React.useEffect(() => {
    setCur(currency && currency !== "Auto" ? currency : detectCurrency());
  }, [currency]);
  const p = PRICE_TABLE[cur] || PRICE_TABLE.USD;
  const tiers: any[] = [
    {
      name: "Free", m: p.free, y: p.free, per: "forever", badge: "No credit card required",
      items: ["Full quality, no watermark", "3 episodes a month", "Email delivery", "No account needed"],
      cta: "Start free",
    },
    {
      name: "Creator", m: p.creator[0], y: p.creator[1], featured: true, badge: "Most popular",
      items: ["Unlimited episodes", "Priority processing"],
      cta: "Get Creator",
    },
    {
      name: "Studio", m: p.studio[0], y: p.studio[1],
      items: ["Everything in Creator", { label: "Batch processing", soon: true }, { label: "API access", soon: true }],
      cta: "Get Studio",
    },
  ];
  return (
    <section className="band" id="pricing" data-screen-label="Pricing">
      <div className="container">
        <div className="pricing-head reveal">
          <div>
            <div className="kicker">Pricing</div>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Start free. Upgrade when your show does.</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className="bill-toggle" role="group" aria-label="Billing period">
              <button className={annual ? "" : "on"} onClick={() => setAnnual(false)}>Monthly</button>
              <button className={annual ? "on" : ""} onClick={() => setAnnual(true)}>Annual</button>
            </div>
            <span className="save-pill">save 2 months</span>
          </div>
        </div>
        <div className="pricing-grid">
          {tiers.map((t, i) => (
            <article className={"price-card reveal reveal-d" + (i + 1) + (t.featured ? " featured" : "")} key={t.name}>
              {t.badge && <span className="price-badge">{t.badge}</span>}
              <h3 className="price-name">{t.name}</h3>
              <div className="price-amount">
                {annual ? t.y : t.m}{" "}
                <small>{t.per ? t.per : annual ? "/year" : "/month"}</small>
              </div>
              <ul className="price-list">
                {t.items.map((it: any) => {
                  const soon = typeof it === "object" && it.soon;
                  const label = typeof it === "object" ? it.label : it;
                  return (
                    <li key={label} className={soon ? "soon" : ""}>
                      {label}
                      {soon && <span className="soon-badge">soon</span>}
                    </li>
                  );
                })}
              </ul>
              <a className={"btn " + (t.featured ? "btn-primary" : "btn-ghost")} href="#try" style={{ justifyContent: "center" }}>{t.cta}</a>
            </article>
          ))}
        </div>
        <p className="microcopy reveal" style={{ marginTop: 24 }}>
          prices in {cur} · based on your browser language
        </p>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function SocialIcon({ kind }: any) {
  const common: any = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "linkedin")
    return (
      <svg {...common} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3"></rect>
        <path d="M8 11v5"></path>
        <path d="M8 8v.01"></path>
        <path d="M12 16v-5"></path>
        <path d="M16 16v-3a2 2 0 0 0-4 0"></path>
      </svg>
    );
  if (kind === "youtube")
    return (
      <svg {...common} aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" rx="3.5"></rect>
        <path d="M10 9.5l5 3-5 3z" fill="currentColor" stroke="none"></path>
      </svg>
    );
  return (
    <svg {...common} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5"></rect>
      <circle cx="12" cy="12" r="3.8"></circle>
      <path d="M17 7v.01"></path>
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="footer" data-screen-label="Footer">
      <div className="container">
        <div className="footer-inner">
          <div>
            <img src="/assets/logo-full.png" alt="Saltwaves.studio" />
            <p className="microcopy" style={{ marginTop: 18, maxWidth: "32ch" }}>
              AI audio tools, built with an engineer's ears.
            </p>
            <div className="footer-social">
              <a href="#" aria-label="LinkedIn"><SocialIcon kind="linkedin" /></a>
              <a href="#" aria-label="YouTube"><SocialIcon kind="youtube" /></a>
              <a href="#" aria-label="Instagram"><SocialIcon kind="instagram" /></a>
            </div>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h4>Tools</h4>
              <ul>
                <li><a href="#try">PodMaster</a></li>
                <li><a href="#tools">PrompterMaster</a></li>
                <li><a href="#tools">Loudness Inspector</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#blog">Blog</a></li>
                <li><a href="/services">Custom Services</a></li>
                <li><a href="mailto:hello@saltwaves.studio">Contact</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-base microcopy">
          <span>© 2026 Saltwaves.studio · Marcus Bornold · Örebro, Sweden</span>
          <span>Mastered, not generated.</span>
        </div>
      </div>
    </footer>
  );
}
