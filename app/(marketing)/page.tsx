import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccessForSession } from "@/lib/access";
import { getPriceIdsFromEnv } from "@/lib/pricing";
import App from "../components/saltwaves-app";

export default async function Home() {
  // This local instance previews Audiobook, including sign-in fallback navigation.
  if (process.env.NODE_ENV !== "production" && process.env.AUDIOBOOK_REMOTE_DEV === "true") {
    redirect("/tools/audiobook");
  }
  const session = await auth();
  const priceIds = getPriceIdsFromEnv();
  // Drives the upload zone's limits. Anonymous visitors get the free tier.
  const access = await getAccessForSession();

  return (
    <App
      isLoggedIn={Boolean(session?.user)}
      priceIds={priceIds}
      access={access}
    />
  );
}
