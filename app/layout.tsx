import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PodMaster by Saltwaves.studio — AI Podcast Mastering",
  description:
    "Master your podcast in 60 seconds. PodMaster cleans noise, balances EQ and matches loudness with AI — built by a sound engineer with 20 years behind the console. Free, no account needed.",
  keywords:
    "podcast mastering, AI audio mastering, podcast loudness, noise reduction, audio mastering online",
  openGraph: {
    title: "PodMaster — AI Podcast Mastering by Saltwaves.studio",
    description:
      "Drop in your episode, get broadcast-ready audio back. Free to try, no account needed.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>{children}</body>
    </html>
  );
}
