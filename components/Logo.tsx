import Image from "next/image";

type LogoProps = {
  className?: string;
};

export default function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Saltwaves"
      width={1254}
      height={1254}
      priority
      className={className}
      style={{ height: 40, width: "auto" }}
    />
  );
}
