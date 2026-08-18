"use client";

import React from "react";
import { demoAudio } from "./saltwaves-ui";
import { DemoCard } from "./saltwaves-sections";

/* Mätvärden för exempelfilen. Ligger samlade här så att de går att byta
   på ett ställe när ljudfilen byts. */
const EXEMPEL = {
  fore: "−38,6 LUFS integrerat · −18,7 dBTP",
  efter: "−18,0 LUFS integrerat · −2,9 dBTP",
  brusgolvFore: "−73 dBFS",
  brusgolvEfter: "−60 dBFS",
};

const CELL: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px 10px 0",
  borderBottom: "1px solid var(--line)",
};

const RAPPORT = [
  {
    parameter: "Integrerad loudness",
    fore: "−38,6 LUFS",
    efter: "−18,0 LUFS",
    krav: "−18,0 ± 0,5",
    utfall: "OK",
    ok: true,
  },
  {
    parameter: "True peak",
    fore: "−18,7 dBTP",
    efter: "−2,9 dBTP",
    krav: "≤ −3,0",
    utfall: "OK",
    ok: true,
  },
  {
    parameter: "Brusgolv",
    fore: "−73 dBFS",
    efter: "−60 dBFS",
    krav: "≤ −60",
    utfall: "OK",
    ok: true,
  },
  {
    parameter: "Signal mot brus",
    fore: "30,8 dB",
    efter: "42,1 dB",
    krav: "—",
    utfall: "+11,3 dB",
    ok: false,
  },
];

const MALGRUPPER = [
  {
    title: "Poddproduktionsbolag",
    text: "Ni klipper redan och ni gör det bra. Vad ni inte har är ett sätt att få fyrtio program att låta som ett hus när sex olika personer har klippt dem. Detta är sista steget före publicering, efter er redigering och inte istället för den.",
  },
  {
    title: "Förlag och ljudboksstudior",
    text: "Era uppläsare spelar in hemma nu. Inspelningarna som kommer tillbaka är fullt användbara, och de är alla lite olika. Detta tar dem till katalogspec utan att produktionsbudgeten höjs på någon enskild titel.",
  },
  {
    title: "Lokalisering och medietjänster",
    text: "Extra kapacitet mot er leveransspec, med en rapport per fil så att kvalitetskontrollen får något att kontrollera istället för något att lyssna igenom.",
  },
];

const LEVERANS = [
  "Integrerad loudness på ert målvärde",
  "True peak under ert tak",
  "Brusgolv hanterat utan det pumpande och sorlande som hård rensning lämnar efter sig",
  "Mono-nedmix där er spec kräver det",
  "En mätrapport per fil, med värden före och efter",
];

const PRISER = [
  {
    title: "Rensning och master",
    price: "900 kr",
    unit: "per färdig speltimme",
    lead: "Ett rensningspass som tar bort klick, munljud, plosiver, brum och rumsklang. Därefter mastring mot er spec, kapitelindelning och mätrapport. Rensningen körs verktygsstyrt med konservativa inställningar, följt av stickprovskontroll i hörlurar på de partier där risken är störst.",
    volume:
      "Vid bokad volym från tio färdiga timmar per månad: 810 kr per färdig speltimme, med garanterad leveranstid.",
  },
  {
    title: "Spec-master",
    price: "500 kr",
    unit: "per färdig speltimme",
    lead: "Teknisk anpassning utan rensning. Loudness, true peak, brusgolv, kapitelindelning och mätrapport. För material som redan är rent och bara ska möta plattformens krav.",
  },
  {
    title: "Poddavsnitt",
    price: "600 kr",
    unit: "per avsnitt",
    lead: "Upp till sextio minuter råmaterial och upp till två röstfiler. Längre avsnitt och fler röster offereras separat.",
  },
];

const MAIL = "mailto:marcus@saltwaves.studio?subject=Testfil%2C%2060%20sekunder";

export default function PostproduktionSida() {
  const [playing, setPlaying] = React.useState<
    "forlag-raw" | "forlag-mastered" | null
  >(null);

  const toggle = (kind: "forlag-raw" | "forlag-mastered") => {
    if (playing === kind) {
      demoAudio.stop();
      setPlaying(null);
    } else {
      demoAudio.play(kind, () => setPlaying(null));
      setPlaying(kind);
    }
  };

  React.useEffect(() => () => demoAudio.stop(), []);

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
        data-screen-label="Postproduktion hero"
        style={{ paddingTop: "clamp(64px, 9vw, 110px)" }}
      >
        <div className="container">
          <div className="reveal in">
            <div className="kicker">Postproduktion</div>
            <h1 style={{ fontSize: "clamp(2.7rem, 5.6vw, 4.4rem)", marginBottom: 20 }}>
              Konsekvent ljudkaraktär över hela katalogen.
            </h1>
            <p className="section-sub" style={{ marginBottom: 18 }}>
              Ni skickar färdigklippt ljud. Ni får tillbaka filer som klarar plattformens
              tekniska krav, med en mätrapport som visar exakt vad som gjordes. Normalt inom
              24 timmar.
            </p>
            <p className="section-sub" style={{ marginBottom: 28 }}>
              Bakom kedjan ligger tjugo års arbete med ljud i streaming, broadcast och live.
              Det är en broadcast-tränad processkedja, kalibrerad mot leveranskrav som mäts.
            </p>
            <a className="btn btn-primary" href={MAIL}>
              Skicka en fil
            </a>
          </div>
        </div>
      </section>

      <section
        className="band"
        style={{ paddingTop: 0 }}
        data-screen-label="Ljudbok före och efter"
      >
        <div className="container">
          <div className="reveal">
            <h2 className="section-title">Inspelat hemma. Levererat till spec.</h2>
            <p className="section-sub">
              En uppläsare i ett vanligt rum utan akustikbehandling, med en enkel dynamisk
              mikrofon. Ingen bås, ingen behandling. Alltså den sortens fil som kommer in när
              inspelningen flyttar ut ur studion. Mål: nordisk ljudbokskatalogspec, −18 LUFS
              och −3 dBTP.
            </p>
          </div>
          <div className="demo-grid">
            <div className="reveal reveal-d1">
              <DemoCard
                kind="raw"
                light
                playing={playing === "forlag-raw"}
                onToggle={() => toggle("forlag-raw")}
                title="Före"
                microcopy={EXEMPEL.fore}
                tags={[]}
              />
            </div>
            <div className="reveal reveal-d2">
              <DemoCard
                kind="mastered"
                light
                playing={playing === "forlag-mastered"}
                onToggle={() => toggle("forlag-mastered")}
                title="Efter"
                microcopy={EXEMPEL.efter}
                tags={[]}
              />
            </div>
          </div>
          <p className="demo-caption reveal">
            Brusgolvet gick från {EXEMPEL.brusgolvFore} till {EXEMPEL.brusgolvEfter}, trots ett
            lyft på nästan 24 decibel. Utan bearbetning hade det landat elva decibel utanför
            spec. Det är den delen som inte gör sig själv. Loudness och true peak gäller det
            45 sekunder långa utsnittet. Brusgolvet är mätt på hela filen.
          </p>

          <div className="reveal" style={{ marginTop: 32, maxWidth: 720 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--mono)",
                fontSize: 13.5,
              }}
            >
              <thead>
                <tr>
                  {["Parameter", "Före", "Efter", "Krav", "Utfall"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px 10px 0",
                        borderBottom: "1.5px solid var(--line)",
                        fontSize: 10.5,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RAPPORT.map((r) => (
                  <tr key={r.parameter}>
                    <td style={CELL}>{r.parameter}</td>
                    <td style={{ ...CELL, color: "var(--ink-soft)" }}>{r.fore}</td>
                    <td style={CELL}>{r.efter}</td>
                    <td style={{ ...CELL, color: "var(--ink-soft)" }}>{r.krav}</td>
                    <td
                      style={{
                        ...CELL,
                        color: r.ok ? "#1e6b3a" : "var(--ink-soft)",
                        fontWeight: r.ok ? 600 : 400,
                        letterSpacing: "0.06em",
                        fontSize: 11.5,
                      }}
                    >
                      {r.utfall}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="microcopy" style={{ marginTop: 14, maxWidth: "68ch" }}>
              Mätmetodik: ITU-R BS.1770-4, K-viktad och gated. True peak 4× översamplad. Varje
              leverans följs av en rapport med samma värden.
            </p>
          </div>
        </div>
      </section>

      <section
        className="band"
        style={{ paddingTop: 0 }}
        data-screen-label="Vad som kommer tillbaka"
      >
        <div className="container">
          <div className="reveal">
            <h2 className="section-title">Vad som kommer tillbaka</h2>
            <p className="section-sub" style={{ marginBottom: 28 }}>
              En färdig master, klippt mot er leveransspec och inte mot min smak.
            </p>
            <ul className="price-list" style={{ marginTop: 0, maxWidth: "62ch" }}>
              {LEVERANS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="section-sub" style={{ marginTop: 8, marginBottom: 28 }}>
              Rapporten betyder mer än den låter. Ni får ett tal att lämna vidare till
              distributören, istället för en tekniker som säger att det låter bra.
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
              Normal leveranstid är 24 timmar.
            </p>
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }} data-screen-label="Priser">
        <div className="container">
          <div className="reveal">
            <h2 className="section-title">Priser</h2>
          </div>
          <div className="steps-grid">
            {PRISER.map((p, i) => (
              <article className={"step-card reveal reveal-d" + (i + 1)} key={p.title}>
                <h3>{p.title}</h3>
                <p
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--orange)",
                    margin: "6px 0 2px",
                  }}
                >
                  {p.price}
                </p>
                <p className="microcopy" style={{ margin: "0 0 12px" }}>
                  {p.unit}
                </p>
                <p>{p.lead}</p>
                {p.volume ? (
                  <p
                    className="microcopy"
                    style={{
                      marginTop: 12,
                      paddingLeft: 14,
                      borderLeft: "3px solid var(--orange)",
                      lineHeight: 1.6,
                    }}
                  >
                    {p.volume}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          <p className="microcopy reveal" style={{ marginTop: 24, maxWidth: "68ch" }}>
            Priser exklusive moms. Betalningsvillkor 15 dagar netto. Vid första uppdraget med
            ny kund delas betalningen, hälften vid beställning och hälften vid leverans.
          </p>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }} data-screen-label="Vem det är för">
        <div className="container">
          <div className="steps-grid">
            {MALGRUPPER.map((card, i) => (
              <article className={"step-card reveal reveal-d" + (i + 1)} key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="band"
        style={{ paddingTop: 0 }}
        data-screen-label="Testa kostnadsfritt"
      >
        <div className="container">
          <div className="reveal" style={{ maxWidth: "62ch" }}>
            <h2 className="section-title">Testa kostnadsfritt</h2>
            <p className="section-sub" style={{ marginBottom: 0 }}>
              Skicka 60 sekunder obehandlat ljud som mailbilaga. Ni får tillbaka en mastrad fil
              och en mätrapport inom 24 timmar, utan kostnad och utan åtagande.
            </p>
          </div>
        </div>
      </section>

      <section className="band cta-banner" data-screen-label="Postproduktion kontakt">
        <div className="container reveal in">
          <p
            className="section-sub"
            style={{
              margin: "0 auto",
              textAlign: "center",
              color: "var(--ink)",
              fontSize: "clamp(1.2rem, 2.4vw, 1.55rem)",
              maxWidth: "40ch",
            }}
          >
            Kontakta mig på{" "}
            <a href={MAIL} style={{ color: "inherit", fontWeight: 700 }}>
              marcus@saltwaves.studio
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
