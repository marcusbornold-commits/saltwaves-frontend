type LogoProps = {
  className?: string;
  dark?: boolean;
};

export default function Logo({ className, dark = false }: LogoProps) {
  return (
    <div
      className={className}
      aria-label="Saltwaves.studio"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "12px",
        fontWeight: 700,
        fontSize: "18px",
        letterSpacing: "-0.01em",
        color: "#1a1a1a",
        textDecoration: "none",
      }}
    >
      <img
        src={dark ? "/brand/emblem-paper.png" : "/brand/emblem-ink.png"}
        alt="Saltwaves emblem"
        style={{ height: "34px", width: "auto" }}
      />
      <span>
        saltwaves<span style={{ color: "#ff6200" }}>.studio</span>
      </span>
    </div>
  );
}
