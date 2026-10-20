import type { Metadata } from "next";
// Egen neutral metadata för Sjöberg-sidan (ingen podcast-metadata från rotlayouten).
const title = "Saltwaves – Ljudboksmastering";
const description = "Automatisk mastering av ljudböcker enligt Storytels krav.";
export const metadata: Metadata = {
  title, description, keywords: [],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: "website", siteName: "Saltwaves" },
  twitter: { card: "summary", title, description },
};
export default function SjobergLayout({ children }: { children: React.ReactNode }) { return children; }
