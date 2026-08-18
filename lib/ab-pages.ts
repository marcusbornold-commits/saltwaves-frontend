export type AbTrack = {
  src: string;
  label: string;
  hint?: string;
};

export type AbPageConfig = {
  slug: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  trackA: AbTrack;
  trackB: AbTrack;
  findings: string[];
};

export const AB_PAGES: Record<string, AbPageConfig> = {
  "earselect-h3m9": {
    slug: "earselect-h3m9",
    title: "Uppläsare i hemmastudio",
    eyebrow: "Saltwaves · privat A/B",
    subtitle:
      "Samma tagning före och efter kedjan. Växla A/B under uppspelning. Nivåerna är som de levererats, ingen nivåmatchning. Utsnitt om 45 sekunder, mål: nordisk ljudbokspec.",
    trackA: {
      src: "/ab/earselect-h3m9/forlag-a-before.mp3",
      label: "A · Rå inläsning",
      hint: "Vanligt rum, dynamisk mikrofon",
    },
    trackB: {
      src: "/ab/earselect-h3m9/forlag-b-after.mp3",
      label: "B · Efter Saltwaves-kedjan",
      hint: "Mastrad mot ljudbokspec",
    },
    findings: [
      "Rå inläsning: −38,6 LUFS · −18,7 dBTP",
      "Efter kedjan: −18,0 LUFS · −2,9 dBTP (levererad wav mäter −3,1; mp3-kodningen lyfter toppen två tiondelar)",
      "Brusgolv över hela filen: −73 → −60 dBFS. Utan bearbetning hade lyftet tagit golvet till cirka −49 dBFS",
      "Mål: nordisk ljudbokspec, −18,0 LUFS ±0,5 och true peak ≤ −3,0 dBTP",
      "Nivåerna är som de levererats, ingen nivåmatchning",
    ],
  },
  "npf-podden-x7k4": {
    slug: "npf-podden-x7k4",
    title: "NPF-podden",
    eyebrow: "Saltwaves · private A/B review",
    subtitle:
      "Compare the episode as delivered on the Acast feed against the Saltwaves mastering chain. Toggle A/B while playing — levels are as delivered, with no level matching.",
    trackA: {
      src: "/ab/npf-podden-x7k4/npf-a-before.mp3",
      label: "A · Delivered episode",
      hint: "Acast feed",
    },
    trackB: {
      src: "/ab/npf-podden-x7k4/npf-b-after.mp3",
      label: "B · After Saltwaves chain",
      hint: "Mastered output",
    },
    findings: [
      "Delivered episode (Acast feed): −11.4 LUFS · −1.0 dBTP · LRA 2.8 LU",
      "After Saltwaves chain: −16.1 LUFS · −3.1 dBTP · no added limiting (PLR 10.4 → 13.0 dB)",
      "Apple Podcasts normalizes playback to −16 LUFS: the delivered file plays 4.6 dB down, Spotify 2.6 dB down",
      "Long-term spectrum vs SR P1 (Söndagsintervjun) reference: presence band restored from −6.7 dB below reference to −1.6 dB; narrow resonances corrected at 580 Hz and 2.8 kHz",
      "Levels are as delivered — no level matching",
    ],
  },
};

export function getAbPage(slug: string): AbPageConfig | undefined {
  return AB_PAGES[slug];
}
