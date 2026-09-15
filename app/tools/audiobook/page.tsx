import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { audiobookAccess } from "@/lib/audiobook-access";
import AudiobookStudio from "./AudiobookStudio";
export const metadata: Metadata = { title: "Audiobook — Saltwaves", description: "Provmastra och jämför din ljudbok.", robots: { index: false, follow: false } };
export default async function Page() {
  if (process.env.NODE_ENV === "production" || process.env.AUDIOBOOK_REMOTE_DEV === "true") {
    if (process.env.AUDIOBOOK_ENABLED !== "true") notFound();
    const { session, allowed } = await audiobookAccess();
    if (!session?.user) redirect("/login?callbackUrl=%2Ftools%2Faudiobook");
    if (!allowed) return <main style={{ padding: 48 }}><h1>Testet är inte öppet för ditt konto ännu.</h1><p>Du är inloggad som {session.user.email}. Använd den e-postadress som har fått tillgång till testet.</p><a href="/login?callbackUrl=%2Ftools%2Faudiobook">Logga in med ett annat konto</a><p>Kontakta Saltwaves om du behöver hjälp.</p></main>;
  }
  return <AudiobookStudio />;
}
