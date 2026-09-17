import type { Metadata } from "next";
import { Wordmark } from "@/app/components/saltwaves-ui";

export const metadata: Metadata = {
  title: "Distans demo — Saltwaves",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function DistansDemoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="distans-demo-header">
        <Wordmark href="#" />
      </header>
      {children}
    </>
  );
}
