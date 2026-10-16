import type { Metadata } from "next";
// Egen metadata för Studio (och invite) så att rotlayoutens podcast-metadata aldrig syns här.
const title = "Saltwaves Studio – Ljudbok";
const description = "Mastering för ljudböcker. Privat förhandsvisning.";
export const metadata: Metadata = {
  title, description, keywords: [],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: "website", siteName: "Saltwaves Studio" },
  twitter: { card: "summary", title, description },
};
export default function StudioLayout({ children }: { children: React.ReactNode }) { return children; }
