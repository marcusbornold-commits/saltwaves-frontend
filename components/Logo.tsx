type LogoProps = {
  className?: string;
};

const INK = "#1a1a1a";
const ORANGE = "#ff6200";

// Traced 1:1 from the brand waveform emblem: 6 bars, width 3, pitch 4,
// vertically centred, heights 5/13/21/17/9/5 with the 3rd bar in orange.
const BARS = [
  { x: 0, h: 5, fill: INK },
  { x: 4, h: 13, fill: INK },
  { x: 8, h: 21, fill: ORANGE },
  { x: 12, h: 17, fill: INK },
  { x: 16, h: 9, fill: INK },
  { x: 20, h: 5, fill: INK },
] as const;

const CENTER_Y = 11;

export default function Logo({ className }: LogoProps) {
  return (
    <div
      className={className}
      aria-label="Saltwaves.studio"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <svg
        width="23"
        height="22"
        viewBox="0 0 23 22"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {BARS.map((bar) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={CENTER_Y - bar.h / 2}
            width="3"
            height={bar.h}
            rx="1.5"
            fill={bar.fill}
          />
        ))}
      </svg>
      <span
        style={{
          fontSize: 20,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "-0.025em",
          color: INK,
        }}
      >
        saltwaves<span style={{ color: ORANGE }}>.studio</span>
      </span>
    </div>
  );
}
