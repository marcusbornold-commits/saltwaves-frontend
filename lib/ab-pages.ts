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
  "tal-k4n2": {
    slug: "tal-k4n2",
    title: "Inspelat tal, vanligt rum",
    eyebrow: "Saltwaves · A/B",
    subtitle:
      "Samma tagning före och efter kedjan. Växla A/B under uppspelning. Nivåerna är som de levererats, ingen nivåmatchning. Utsnitt om 45 sekunder, mål: nordisk ljudbokspec.",
    trackA: {
      src: "/ab/tal-k4n2/tal-a-before.mp3",
      label: "A · Rå inspelning",
      hint: "Vanligt rum, dynamisk mikrofon",
    },
    trackB: {
      src: "/ab/tal-k4n2/tal-b-after.mp3",
      label: "B · Efter Saltwaves-kedjan",
      hint: "Mastrad mot leveransspec",
    },
    findings: [
      "Rå inspelning: −38,6 LUFS · −18,7 dBTP",
      "Efter kedjan: −18,0 LUFS · −2,9 dBTP (levererad wav mäter −3,1; mp3-kodningen lyfter toppen två tiondelar)",
      "Brusgolv över hela filen: −73 → −60 dBFS. Utan bearbetning hade lyftet tagit golvet till cirka −49 dBFS",
      "Mål här: nordisk ljudbokspec, −18,0 LUFS ±0,5 och true peak ≤ −3,0 dBTP. Kedjan kör mot den spec ni levererar mot, oavsett om det är ljudbok, e-learning eller podd",
      "Kedjan gör en genomkörning per fil utan anpassning per talare. Byggd för en röst i taget",
      "Nivåerna är som de levererats, ingen nivåmatchning",
    ],
  },
  "faltinspelning-0abd": {
    slug: "faltinspelning-0abd",
    title: "Fältinspelning",
    eyebrow: "Saltwaves · private A/B review",
    subtitle:
      "A raw field recording, straight off the recorder, against the same 35 seconds through the Saltwaves mastering chain at EBU R128 broadcast spec. Identical window in both tracks, no level matching.",
    trackA: {
      src: "/ab/faltinspelning-0abd/falt-a-before.mp3",
      label: "A · Raw field recording",
      hint: "Straight off the recorder",
    },
    trackB: {
      src: "/ab/faltinspelning-0abd/falt-b-after.mp3",
      label: "B · After Saltwaves chain",
      hint: "Broadcast −23 LUFS",
    },
    findings: [
      "Raw field recording, this excerpt: −24.0 LUFS · −5.9 dBTP · LRA 6.2 LU",
      "After Saltwaves chain: −23.3 LUFS · −6.3 dBTP · LRA 5.1 LU",
      "The two tracks sit 0.7 LU apart. No level matching was applied — the raw take was already close to the broadcast target, so most of what you hear is processing, not level",
      "Delivered master measures −22.8 LUFS with a noise floor at −65 dBFS. Broadcast spec asks for −23.0 ±0.5 LUFS, true peak ≤ −1.0 dBTP and a noise floor under −55 dBFS. All three pass",
      "Long-term spectrum: rumble below 80 Hz down 5.8 dB, warmth and body up around 1.5 dB, 6–9 kHz up 4.2 dB relative to the speech core",
      "Chain: DeepFilterNet3 on a Saltwaves-trained checkpoint, 90 Hz low-cut, condenser presence curve",
      "35-second excerpt, identical window in both tracks",
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
