// app/tools/ab-analyzer/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import AbAnalyzer from "./AbAnalyzer";

export const metadata: Metadata = {
  title: "A/B Loudness Analyzer — Saltwaves",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AbAnalyzer />
    </Suspense>
  );
}
