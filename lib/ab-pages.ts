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
  "faltinspelning-0abd": {
    slug: "faltinspelning-0abd",
    title: "Fältinspelning",
    eyebrow: "Saltwaves · private A/B review",
    subtitle:
      "Compare the raw field recording, straight off the recorder, against the same take through the Saltwaves mastering chain delivered to EBU R128 broadcast spec. Toggle A/B while playing — levels are as delivered, with no level matching.",
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
      "Raw field recording: −23.3 LUFS · +2.3 dBTP · LRA 8.4 LU · noise floor −52.2 dB",
      "After Saltwaves chain: −23.0 LUFS · −2.9 dBTP · LRA 6.7 LU · gated passages digitally silent",
      "Broadcast target (EBU R128): −23 LUFS · −1 dBTP · noise floor −55 dB — the raw take overshot true peak by 3.3 dB and missed the noise floor by 2.8 dB",
      "Clipping removed: 447 samples pinned at 0 dBFS (flat factor 22.8) → 2 samples, flat factor 0",
      "Chain: DeepFilterNet3 on a Saltwaves-trained checkpoint, 90 Hz low-cut, condenser presence curve — 12.0 dB cut at 586 Hz (boxiness), 5.5 dB at 2.5 kHz (presence peak)",
      "60-second excerpt from 05:00, identical window in both tracks — levels are as delivered, no level matching",
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
