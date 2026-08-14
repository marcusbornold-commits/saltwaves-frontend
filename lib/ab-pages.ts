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
      "A raw field recording, straight off the recorder, against the same 60 seconds through the Saltwaves mastering chain at EBU R128 broadcast spec. Both tracks land within 0.1 LU of each other, so nothing you hear is a loudness difference. It is noise, room and clipping.",
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
      "Raw field recording, this excerpt: −24.0 LUFS · +1.9 dBTP · LRA 4.3 LU · noise floor −50.3 dB",
      "After Saltwaves chain: −24.0 LUFS · −4.9 dBTP · LRA 5.1 LU · noise floor −78.3 dB",
      "The two tracks sit 0.01 LU apart. No level matching was applied — the raw take happened to land on the broadcast target already, so the comparison is processing only",
      "The raw take clips: 447 samples pinned at full scale in the source recording, and this excerpt still reconstructs to +1.9 dBTP, above digital zero. After the chain, true peak is −4.9 dBTP",
      "Noise floor drops 27.9 dB. Broadcast spec asks for −55 dB; the raw take missed it at −50.3 dB and lands at −78.3 dB after",
      "Chain: DeepFilterNet3 on a Saltwaves-trained checkpoint, 90 Hz low-cut, condenser presence curve — 12.0 dB cut at 586 Hz (boxiness), 5.5 dB at 2.5 kHz (presence peak)",
      "60-second excerpt from 00:30, identical window in both tracks",
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
