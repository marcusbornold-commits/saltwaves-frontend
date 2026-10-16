import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { audiobookAccess } from "@/lib/audiobook-access";
import StudioV1 from "./StudioV1";
export const metadata: Metadata = { title: "Saltwaves Studio – Ljudbok", description: "Mastering för ljudböcker. Privat förhandsvisning.", robots: { index: false, follow: false } };
export default async function Page() {
  if (process.env.NODE_ENV === "production" || process.env.AUDIOBOOK_REMOTE_DEV === "true") {
    if (process.env.AUDIOBOOK_ENABLED !== "true" || !process.env.AUDIOBOOK_STUDIO_API_URL) notFound();
    const { session, allowed } = await audiobookAccess();
    if (!session?.user) redirect("/login?callbackUrl=%2Ftools%2Faudiobook%2Fstudio");
    if (!allowed) notFound();
  }
  return <StudioV1 />;
}
