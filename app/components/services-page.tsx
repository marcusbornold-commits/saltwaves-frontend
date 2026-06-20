"use client";

import React from "react";
const PACKAGES = [
  {
    kicker: "Kom igång",
    title: "Streaming-setup + grafiktriggers",
    price: "18 000 kr",
    delivery: "~3 arbetsdagar",
    lead: "En sändning som ser broadcast-mässig ut – körd av en person.",
    includes: [
      "Komplett OBS/vMix-setup",
      "Lower thirds + grafik som triggas live",
      "Ljudkedja inställd",
      "Genomförd testsändning",
      "Körschema + lathund",
    ],
    subject: "Intresse: Streaming-setup + grafiktriggers",
    featured: false,
  },
  {
    kicker: "Vanligast",
    title: "Produktionsdashboard på en vecka",
    price: "25 000 kr",
    delivery: "En vecka",
    lead: "En knapp, rätt sak händer. Ingen operatör behöver minnas allt.",
    includes: [
      "Dashboard i Bitfocus Companion + Stream Deck",
      "Scenbyten/grafik/ljud/inspelning mappade",
      "Statusåterkoppling",
      "Dokumentation",
      "Genomgång med teamet",
    ],
    subject: "Intresse: Produktionsdashboard på en vecka",
    featured: true,
  },
  {
    kicker: "Skala upp",
    title: "Automationsflöde Companion / vMix / NDI",
    price: "35 000 kr",
    delivery: "~1–2 veckor",
    lead: "Skala produktionen utan att anställa fler operatörer.",
    includes: [
      "vMix + NDI-routing + Companion sammankopplat",
      "Automatiserade scenövergångar",
      "Triggers mot grafik/inspelning/stream",
      "Failsafe-rutiner",
      "Överlämning + utbildning",
    ],
    subject: "Intresse: Automationsflöde Companion / vMix / NDI",
    featured: false,
  },
];

function mailtoHref(subject: string) {
  return `mailto:hello@saltwaves.studio?subject=${encodeURIComponent(subject)}`;
}

export default function ServicesPage() {
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
    <>
      <main>
        <section
          className="band"
          data-screen-label="Services hero"
          style={{ paddingTop: "clamp(64px, 9vw, 110px)" }}
        >
          <div className="container">
            <div className="reveal in">
              <div className="kicker">Konsulttjänster</div>
              <h1 style={{ fontSize: "clamp(2.7rem, 5.6vw, 4.4rem)", marginBottom: 20 }}>
                Fast pris. Fast leverans. Inga offertrundor.
              </h1>
              <p className="section-sub" style={{ marginBottom: 22 }}>
                Tre paket för live- och streamingproduktion. 20 år i broadcast och TV, idag med fokus
                på livestreamade event — jag har gjort det mesta som kan gå fel, och löst det.
              </p>
              <p className="microcopy">Fast pris · Fast leverans · Inga offertrundor</p>
            </div>
          </div>
        </section>

        <section className="band" style={{ paddingTop: 0 }} data-screen-label="Service packages">
          <div className="container">
            <div className="pricing-grid">
              {PACKAGES.map((pkg, i) => (
                <article
                  className={
                    "price-card reveal reveal-d" + (i + 1) + (pkg.featured ? " featured" : "")
                  }
                  key={pkg.title}
                >
                  <span className="price-badge">{pkg.kicker}</span>
                  <h2 className="price-name">{pkg.title}</h2>
                  <div className="price-amount" style={{ color: "var(--orange)" }}>
                    {pkg.price}
                  </div>
                  <p className="microcopy" style={{ marginBottom: 16 }}>
                    {pkg.delivery}
                  </p>
                  <p className="section-sub" style={{ fontSize: 16, marginBottom: 0 }}>
                    {pkg.lead}
                  </p>
                  <ul className="price-list">
                    {pkg.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <a
                    className="btn btn-primary"
                    href={mailtoHref(pkg.subject)}
                    style={{ justifyContent: "center" }}
                  >
                    Boka paket
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="band cta-banner" data-screen-label="Services CTA">
          <div className="container reveal in">
            <h2>Osäker på vilket paket?</h2>
            <p className="section-sub" style={{ margin: "0 auto 30px", textAlign: "center" }}>
              Skicka ett mail med kort beskrivning av er setup — vi pekar er i rätt riktning. Inget
              sälj, inget åtagande.
            </p>
            <a
              className="btn btn-ink"
              href={mailtoHref("Osäker på vilket paket?")}
              style={{ fontSize: 17 }}
            >
              Skicka ett mail
            </a>
            <span className="microcopy">hello@saltwaves.studio</span>
          </div>
        </section>
      </main>
    </>
  );
}
