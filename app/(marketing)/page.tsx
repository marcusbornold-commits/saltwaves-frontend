import { auth } from "@/auth";
import { getPriceIdsFromEnv } from "@/lib/pricing";
import App from "../components/saltwaves-app";

export default async function Home() {
  const session = await auth();
  const priceIds = getPriceIdsFromEnv();

  return (
    <App
      isLoggedIn={Boolean(session?.user)}
      priceIds={priceIds}
    />
  );
}
