import { auth } from "@/auth";
import { getPriceIdsFromEnv } from "@/lib/pricing";
import PricingPlans from "./pricing-plans";
import "./pricing.css";

type PricingPageProps = {
  searchParams: Promise<{
    checkout?: string;
  }>;
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const session = await auth();
  const { checkout } = await searchParams;
  const priceIds = getPriceIdsFromEnv();

  return (
    <main className="pricing-page">
      <div className="pricing-shell">
        {checkout === "cancel" && (
          <p className="pricing-notice">Checkout cancelled. Pick a plan when you are ready.</p>
        )}

        <PricingPlans isLoggedIn={Boolean(session?.user)} priceIds={priceIds} />
      </div>
    </main>
  );
}
