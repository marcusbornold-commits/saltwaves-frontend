import { auth } from "@/auth";
import { getPriceIdsFromEnv } from "@/lib/pricing";
import type { Metadata } from "next";
import PricingPlans from "./pricing-plans";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Pricing — PodMaster by Saltwaves",
  description:
    "Start free with 2 hours of processing a month. Upgrade to Creator for 10 hours, or Studio for 30 hours with priority delivery.",
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
