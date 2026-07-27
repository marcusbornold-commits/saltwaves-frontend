"use client";

import React from "react";

const AUDIENCES = [
  {
    title: "Podcast production companies",
    text: "You already edit. You already cut. What you don't have is a way to make forty shows sound like they came from one house when six different editors touched them. This is the last step before publishing — after your edit, not instead of it.",
  },
  {
    title: "Publishers and audiobook studios",
    text: "Your narrators record at home now. The recordings that come back are fine, and they're all slightly different. This brings them to catalogue spec without raising the production budget on any single title.",
  },
  {
    title: "Localisation and media services",
    text: "Overflow capacity against your delivery spec, with a report per file so QC has something to check rather than something to listen to.",
  },
];

const DELIVERABLES = [
  "Integrated loudness at your target",
  "True peak under your ceiling",
  "Noise floor handled without the pumping and swirl that aggressive cleanup leaves behind",
  "Mono downmix where your spec calls for it",
  "A measurement report per file, before and after",
];

const MAIL = "mailto:hello@saltwaves.studio?subject=Post-production%20enquiry";

export default function PostProductionPage() {
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
        if (r.top < vh * 0.92 && r.bottom > 0) {
          el.classList.add("in");
          return false;
        }
        return true;
      });
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <main>
      <section
        className="band"
        data-screen-label="Post-production hero"
        style={{ paddingTop: "clamp(64px, 9vw, 110px)" }}
      >
        <div className="container">
          <div className="reveal in">
            <div className="kicker">Post-production</div>
            <h1 style={{ fontSize: "clamp(2.7rem, 5.6vw, 4.4rem)", marginBottom: 20 }}>
              Your catalogue doesn&apos;t sound like one catalogue.
            </h1>
            <p className="section-sub" style={{ marginBottom: 18 }}>
              Different rooms, different mics, different people editing. Every episode lands
              somewhere slightly different — and the only fix that scales is a final pass that
              treats all of them the same way.
            </p>
            <p className="section-sub" style={{ marginBottom: 28 }}>
              I&apos;ve spent twenty years behind the console. Live sound, broadcast, TV,
              streaming. Saltwaves is that pass, run consistently, on whatever you send.
            </p>
            <a className="btn btn-primary" href={MAIL}>
              Send a file
            </a>
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }} data-screen-label="What comes back">
        <div className="container">
          <div className="reveal">
            <h2 className="section-title">What comes back</h2>
            <p className="section-sub" style={{ marginBottom: 28 }}>
              A finished master, cut to your delivery spec — not to my taste.
            </p>
            <ul className="price-list" style={{ marginTop: 0, maxWidth: "62ch" }}>
              {DELIVERABLES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="section-sub" style={{ marginTop: 8, marginBottom: 28 }}>
              The report matters more than it sounds. You get a number you can hand to a
              distributor, not an engineer telling you it sounds fine.
            </p>
            <p
              style={{
                fontSize: "clamp(1.35rem, 2.4vw, 1.75rem)",
                fontWeight: 700,
                color: "var(--orange)",
                letterSpacing: "-0.02em",
                maxWidth: "28ch",
              }}
            >
              Standard turnaround is 24 hours.
            </p>
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }} data-screen-label="Who it's for">
        <div className="container">
          <div className="steps-grid">
            {AUDIENCES.map((card, i) => (
              <article className={"step-card reveal reveal-d" + (i + 1)} key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }} data-screen-label="What this isn't built for">
        <div className="container">
          <div className="reveal" style={{ maxWidth: "62ch" }}>
            <h2 className="section-title">What this isn&apos;t built for</h2>
            <p className="section-sub" style={{ marginBottom: 18 }}>
              The chain processes one file end to end, with one set of decisions. That&apos;s a
              strength for a solo host, a narrator, a single mic in a single room. If you have a
              recording with several speakers, send each one as a separate file.
            </p>
            <p className="section-sub" style={{ marginBottom: 18 }}>
              It&apos;s built for speech. It is not a music mastering service.
            </p>
            <p className="section-sub" style={{ marginBottom: 0 }}>
              I&apos;d rather tell you that now than after you&apos;ve sent me something it
              can&apos;t do well.
            </p>
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }} data-screen-label="Send raw, not published">
        <div className="container">
          <div className="reveal" style={{ maxWidth: "62ch" }}>
            <h2 className="section-title">Send raw, not published</h2>
            <p className="section-sub" style={{ marginBottom: 18 }}>
              Sixty seconds of raw audio is enough. Not a published episode — those are already
              mastered, and running them through anything just amplifies whatever cleanup was done
              the first time.
            </p>
            <p className="section-sub" style={{ marginBottom: 18 }}>
              Better still: send a raw file from something you&apos;ve already delivered. You have
              the finished version, so you have something to compare against.
            </p>
            <p className="section-sub" style={{ marginBottom: 0 }}>
              No file service, no export dialogue. A mail attachment is fine.
            </p>
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }} data-screen-label="For procurement">
        <div className="container">
          <div className="reveal" style={{ maxWidth: "62ch" }}>
            <h2
              className="section-title"
              style={{ fontSize: "clamp(1.15rem, 2vw, 1.35rem)", marginBottom: 12 }}
            >
              For procurement
            </h2>
            <p className="microcopy" style={{ maxWidth: "68ch", lineHeight: 1.65, margin: 0 }}>
              Sole proprietorship registered in Sweden, F-tax certified. Processing runs on our own
              hardware inside the EU — nothing is sent to third-party services. Uploaded material is
              deleted after processing; delivered files within 48 hours. A Data Processing Agreement
              under GDPR Article 28 is available on request.
            </p>
          </div>
        </div>
      </section>

      <section className="band cta-banner" data-screen-label="Post-production contact">
        <div className="container reveal in">
          <p
            className="section-sub"
            style={{
              margin: "0 auto",
              textAlign: "center",
              color: "var(--ink)",
              fontSize: "clamp(1.2rem, 2.4vw, 1.55rem)",
              maxWidth: "36ch",
            }}
          >
            <a href={MAIL} style={{ color: "inherit", fontWeight: 700 }}>
              hello@saltwaves.studio
            </a>{" "}
            — direct to me. No form, no sales sequence.
          </p>
        </div>
      </section>
    </main>
  );
}
