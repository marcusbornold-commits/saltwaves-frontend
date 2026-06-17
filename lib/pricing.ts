export type BillingPeriod = "monthly" | "annual";

export type PriceIds = {
  creatorMonthly: string;
  creatorYearly: string;
  studioMonthly: string;
  studioYearly: string;
};

export type PlanFeature =
  | string
  | { label: string; soon?: boolean };

export type PricingTier = {
  id: "free" | "creator" | "studio";
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  per?: string;
  badge?: string;
  featured?: boolean;
  items: PlanFeature[];
  cta: string;
  href?: string;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    per: "forever",
    badge: "No credit card required",
    items: [
      "Full quality, no watermark",
      "3 episodes a month",
      "Email delivery",
      "No account needed",
    ],
    cta: "Start free",
    href: "/",
  },
  {
    id: "creator",
    name: "Creator",
    monthlyPrice: "$14",
    annualPrice: "$190",
    badge: "Most popular",
    featured: true,
    items: ["Unlimited episodes", "Priority processing"],
    cta: "Get Creator",
  },
  {
    id: "studio",
    name: "Studio",
    monthlyPrice: "$29",
    annualPrice: "$390",
    items: [
      "Everything in Creator",
      { label: "Batch processing", soon: true },
      { label: "API access", soon: true },
    ],
    cta: "Get Studio",
  },
];

export function getSubscriptionPriceId(
  plan: "creator" | "studio",
  billing: BillingPeriod,
  priceIds: PriceIds
): string {
  if (plan === "creator") {
    return billing === "annual" ? priceIds.creatorYearly : priceIds.creatorMonthly;
  }
  return billing === "annual" ? priceIds.studioYearly : priceIds.studioMonthly;
}

export function getPriceIdsFromEnv(): PriceIds {
  const creatorMonthly = process.env.STRIPE_PRICE_CREATOR_MONTHLY;
  const creatorYearly = process.env.STRIPE_PRICE_CREATOR_YEARLY;
  const studioMonthly = process.env.STRIPE_PRICE_STUDIO_MONTHLY;
  const studioYearly = process.env.STRIPE_PRICE_STUDIO_YEARLY;

  if (!creatorMonthly || !creatorYearly || !studioMonthly || !studioYearly) {
    throw new Error("Subscription Stripe price IDs are not configured");
  }

  return {
    creatorMonthly,
    creatorYearly,
    studioMonthly,
    studioYearly,
  };
}
