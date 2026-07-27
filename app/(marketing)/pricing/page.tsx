import { auth } from "@/auth";
import { getPriceIdsFromEnv } from "@/lib/pricing";
import type { Metadata } from "next";
import PricingPlans from "./pricing-plans";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Pricing — PodMaster by Saltwaves",
  description:
    "Start free with 3 episodes a month. Upgrade to Creator or Studio for unlimited processing and priority delivery.",
};

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
