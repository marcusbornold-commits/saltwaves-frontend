// Tydlig underkänd-text: per avvikande punkt mätt värde, krav och vad som behöver ändras (Audiobook Nordic).
// Delas av portalen, producentsidan och e-postnotiser. Ren funktion, ingen server- eller klientkod.
export type AdviceCheck = { id: string; label: string; value: number | string | null; unit: string; requirement: string; pass: boolean };
const sv = (t: string) => t.replace(/(\d)\.(\d)/g, "$1,$2").replace(/-(?=\d)/g, "−");
const num = (v: number) => sv(v.toFixed(1));
const REQ: Record<string, string> = { loudness: "−17,5 LUFS ±0,5", peak: "max −3,0 dBTP", noise: "max −80 dBFS", format: "44,1 kHz / 16 bit / mono" };
export function adviceLine(c: AdviceCheck): string {
  const v = typeof c.value === "number" ? `${num(c.value)} ${c.unit}`.trim() : sv(String(c.value ?? "okänt"));
  const req = REQ[c.id] || c.requirement;
  let fix = "";
  if (c.id === "loudness" && typeof c.value === "number") {
    const diff = Math.abs(-17.5 - c.value);
    fix = c.value < -17.5 ? `Höj ljudnivån med cirka ${num(diff)} dB.` : `Sänk ljudnivån med cirka ${num(diff)} dB.`;
  } else if (c.id === "loudness") fix = "Justera ljudnivån till −17,5 LUFS.";
  else if (c.id === "peak") fix = "Sänk toppnivån med en limiter (true peak-tak −3,0 dBTP).";
  else if (c.id === "noise") fix = "Sänk bruset i pauserna, till exempel med brusreducering eller en gate.";
  else if (c.id === "format") fix = "Exportera som WAV 44,1 kHz, 16 bit, mono.";
  return `${c.label} ${v} – krav ${req}. ${fix}`.trim();
}
export const adviceLines = (checks: AdviceCheck[] | null | undefined) => (checks || []).filter(c => !c.pass).map(adviceLine);
