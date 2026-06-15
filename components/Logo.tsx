import Image from "next/image";

export default function Logo() {
  return (
    <Image
      src="/assets/logo-full.png"
      alt="Saltwaves.studio"
      width={180}
      height={40}
      priority
    />
  );
}
