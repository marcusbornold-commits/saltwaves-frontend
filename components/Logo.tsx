type LogoProps = {
  className?: string;
};

const BARS = [
  { x: 1, y: 9, h: 11 },
  { x: 4.5, y: 2, h: 18 },
  { x: 8, y: 12, h: 8 },
  { x: 11.5, y: 6, h: 14 },
  { x: 15, y: 10, h: 10 },
] as const;

export default function Logo({ className }: LogoProps) {
  return (
    <div
      className={["flex items-center gap-2", className].filter(Boolean).join(" ")}
      aria-label="Saltwaves.studio"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {BARS.map((bar) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={bar.y}
            width="2"
            height={bar.h}
            rx="1"
            fill="#ff6200"
          />
        ))}
      </svg>
      <span className="text-[20px] font-semibold leading-none tracking-tight text-[#1a1a1a]">
        saltwaves<span className="text-[#ff6200]">.studio</span>
      </span>
    </div>
  );
}
