"use client";

import { useState } from "react";
import Link from "next/link";
import { startCheckout } from "@/lib/checkout-client";
import {
  getSubscriptionPriceId,
  PRICING_TIERS,
  type BillingPeriod,
  type PlanFeature,
  type PriceIds,
} from "@/lib/pricing";

type PricingPlansProps = {
  isLoggedIn: boolean;
  priceIds: PriceIds;
};

function featureLabel(item: PlanFeature): string {
  return typeof item === "string" ? item : item.label;
}

function isSoon(item: PlanFeature): boolean {
  return typeof item === "object" && Boolean(item.soon);
}

export default function PricingPlans({ isLoggedIn, priceIds }: PricingPlansProps) {
  const [annual, setAnnual] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const billing: BillingPeriod = annual ? "annual" : "monthly";

  async function handlePaidCheckout(plan: "creator" | "studio") {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent("/pricing");
      window.location.href = `/login?callbackUrl=${callbackUrl}`;
      return;
    }

    const priceId = getSubscriptionPriceId(plan, billing, priceIds);
    setLoadingPlan(plan);

    try {
      await startCheckout(priceId);
    } catch {
      setLoadingPlan(null);
    }
  }

  return (
    <>
      <div className="pricing-head">
        <div>
          <div className="pricing-kicker">Pricing</div>
          <h1 className="pricing-title" style={{ marginBottom: 0 }}>
            Start free. Upgrade when your show does.
          </h1>
        </div>
        <div className="pricing-toggle-wrap">
          <div className="bill-toggle" role="group" aria-label="Billing period">
            <button
              type="button"
              className={annual ? "" : "on"}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={annual ? "on" : ""}
              onClick={() => setAnnual(true)}
            >
              Annual — save 2 months
            </button>
          </div>
          {annual && <span className="save-pill">save 2 months</span>}
        </div>
      </div>

      <div className="pricing-grid">
        {PRICING_TIERS.map((tier) => {
          const amount = annual ? tier.annualPrice : tier.monthlyPrice;
          const period = tier.per ?? (annual ? "/year" : "/month");
          const isPaid = tier.id === "creator" || tier.id === "studio";
          const isLoading = loadingPlan === tier.id;

          return (
            <article
              key={tier.id}
              className={`price-card${tier.featured ? " featured" : ""}`}
            >
              {tier.badge && <span className="price-badge">{tier.badge}</span>}
              <h3 className="price-name">{tier.name}</h3>
              <div className="price-amount">
                {amount} <small>{period}</small>
              </div>
              <ul className="price-list">
                {tier.items.map((item) => {
                  const label = featureLabel(item);
                  const soon = isSoon(item);
                  return (
                    <li key={label} className={soon ? "soon" : ""}>
                      {label}
                      {soon && <span className="soon-badge">soon</span>}
                    </li>
                  );
                })}
              </ul>
              {tier.href ? (
                <Link href={tier.href} className="pricing-btn pricing-btn-ghost">
                  {tier.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`pricing-btn ${tier.featured ? "pricing-btn-primary" : "pricing-btn-ghost"}`}
                  disabled={isLoading}
                  onClick={() => handlePaidCheckout(tier.id as "creator" | "studio")}
                >
                  {isLoading ? "Redirecting…" : tier.cta}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <p className="pricing-microcopy">All prices in USD. Tax calculated at checkout.</p>
    </>
  );
}
