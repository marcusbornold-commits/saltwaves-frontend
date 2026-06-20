"use client";

import { usePathname } from "next/navigation";
import { Footer, Nav } from "../components/saltwaves-sections";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const dark = pathname === "/";

  return (
    <>
      <Nav dark={dark} />
      {children}
      <Footer />
    </>
  );
}
