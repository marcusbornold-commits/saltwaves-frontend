"use client";
// saltwaves-sections2.jsx — tools suite, FAQ, blog teaser, final CTA banner
import React from "react";
import { WaveBars } from "./saltwaves-ui";

function ToolArrow() {
  return (
    <svg className="tool-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10h12"></path><path d="M11 5l5 5-5 5"></path>
    </svg>
  );
}

function ToolCard({ name, desc, tag, soon, flagship, href }: any) {
  const cls = "tool-card" + (flagship ? " flagship" : "") + (soon ? " soon" : "");
  const inner = (
    <React.Fragment>
      <div className="tool-head">
        <span className="tool-name">{name}</span>
        {soon
          ? <span className="tool-badge">Coming soon</span>
          : (flagship ? <span className="tool-badge live">Live</span> : <ToolArrow />)}
      </div>
      <p>{desc}</p>
      <span className="tool-tag">{tag}</span>
      {flagship && (
        <div style={{ marginTop: 10 }}>
          <WaveBars n={72} seed={5.5} height={36} />
        </div>
      )}
    </React.Fragment>
  );
  if (soon) return <article className={cls} data-status="hidden">{inner}</article>;
  return <a className={cls} href={flagship ? "#try" : "#"}>{inner}</a>;
}

export function ToolsSuite() {
  return (
    <section className="band" id="tools" data-section="tools" data-screen-label="Tools suite">
      <div className="container">
        <div className="reveal">
          <div className="kicker">The Saltwaves suite</div>
          <h2 className="section-title">One studio. Many tools.</h2>
          <p className="section-sub">Everything is built on the same principle: pro audio results without the pro audio learning curve.</p>
        </div>
        <div className="tools-grid">
          <div className="reveal reveal-d1" style={{ gridColumn: "1 / -1", display: "grid" }}>
            <ToolCard flagship name="PodMaster" desc="Broadcast-grade podcast mastering. Drop an episode, get broadcast-ready audio back in about a minute." tag="flagship · free tier" />
          </div>
          <div className="reveal reveal-d1" style={{ display: "grid" }}>
            <ToolCard name="PrompterMaster" desc="Free browser teleprompter. No download needed." tag="free · in your browser" />
          </div>
          <div className="reveal reveal-d2" style={{ display: "grid" }}>
            <ToolCard name="Loudness Inspector" desc="Free LUFS / true peak compliance checker for any platform spec." tag="free · instant check" />
          </div>
          <div className="reveal reveal-d2" style={{ display: "grid" }}>
            <ToolCard soon name="AudioFixer" desc="Audio restoration for video creators." tag="in the workshop" />
          </div>
          <div className="reveal reveal-d3" style={{ display: "grid" }}>
            <ToolCard soon name="MeetingMaster" desc="Post-processing for recorded meetings." tag="in the workshop" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
const FAQ_ITEMS = [
  { q: "Do you store my audio files?", a: "We process, deliver, and delete. Uploads go away after processing; mastered files within 48 hours — all plans, pre-v2." },
  { q: "What file formats are supported?", a: ".wav and .mp3, up to 200 MB on the free tier." },
  { q: "How is this different from Auphonic?", a: "Auphonic runs generic loudness algorithms. PodMaster is trained on real studio sessions curated by a broadcast engineer with 20 years behind the console — it makes the same calls a human would." },
  { q: "Can I use it for music?", a: "PodMaster is built for spoken word — that's the entire point. Episodes with music beds and intros work, but the chain is tuned for voice, not for mastering music releases. If your show is music-heavy, tell us — it helps us prioritize." },
  { q: "How long does processing take?", a: "Typically a few minutes per episode. You upload, we process, and the finished file lands in your inbox — no need to keep the tab open." },
  { q: "Where is my audio processed?", a: "On our own hardware in the EU. Nothing is sent to third-party AI APIs, and files are deleted after delivery." },
  { q: "What do I need to do before uploading?", a: "Nothing. Upload your raw recording — no pre-processing, no noise reduction, no EQ. The chain works best on untouched audio." },
  { q: "Do you support multiple speakers?", a: "Yes. Interviews and multi-host episodes work fine — the chain is tuned for conversational spoken word." },
  { q: "Who is this built by?", a: "Marcus Bornold — 20 years in live sound, broadcast and TV production." },
];

export function FAQ() {
  const [open, setOpen] = React.useState(0);
  return (
    <section className="band" id="faq" data-screen-label="FAQ" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="reveal">
          <div className="kicker">FAQ</div>
          <h2 className="section-title">Fair questions.</h2>
        </div>
        <div className="faq-list reveal reveal-d1">
          {FAQ_ITEMS.map((item, i) => (
            <div className={"faq-item" + (open === i ? " open" : "")} key={i}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                {item.q}
                <svg className="faq-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 3v12"></path><path d="M3 9h12"></path>
                </svg>
              </button>
              <div className="faq-a"><div><p>{item.a}</p></div></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Blog teaser ---------- */
const BLOG_POSTS = [
  { title: "How loud should a podcast be? The LUFS guide", teaser: "Spotify, Apple, YouTube — every platform has a number. Here's the one that matters." },
  { title: "Adobe Podcast vs PodMaster — an honest comparison", teaser: "Where the big tools shine, where they smear — and when you'd pick which." },
  { title: "How to remove echo from a podcast recording", teaser: "Why your room sounds like a bathroom, and what actually fixes it." },
];

export function BlogTeaser() {
  return (
    <section className="band" id="blog" data-status="hidden" data-screen-label="Blog teaser" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="reveal">
          <div className="kicker">From the workbench</div>
          <h2 className="section-title">Notes on better sound.</h2>
        </div>
        <div className="blog-grid">
          {BLOG_POSTS.map((p, i) => (
            <article className={"blog-card reveal reveal-d" + (i + 1)} key={p.title}>
              <span className="blog-badge">Coming soon</span>
              <h3>{p.title}</h3>
              <p>{p.teaser}</p>
              <span className="blog-more">Read more →</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Final CTA banner ---------- */
export function FinalCTA() {
  return (
    <section className="band cta-banner" data-screen-label="Final CTA">
      <div className="container reveal">
        <h2>Your next episode. Broadcast-ready.</h2>
        <a className="btn btn-ink" href="#try" style={{ fontSize: 17 }}>Try PodMaster free</a>
        <span className="microcopy">Free · No account needed · .wav / .mp3</span>
      </div>
    </section>
  );
}
