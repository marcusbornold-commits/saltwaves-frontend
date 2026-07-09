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
