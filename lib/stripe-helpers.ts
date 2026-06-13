export type PlanSlug = "creator" | "studio";

const creatorPrices = () =>
  [
    process.env.STRIPE_PRICE_CREATOR_MONTHLY,
    process.env.STRIPE_PRICE_CREATOR_YEARLY,
  ].filter(Boolean) as string[];

const studioPrices = () =>
  [
    process.env.STRIPE_PRICE_STUDIO_MONTHLY,
    process.env.STRIPE_PRICE_STUDIO_YEARLY,
  ].filter(Boolean) as string[];

export function getPlanFromPriceId(priceId: string): PlanSlug | null {
  if (creatorPrices().includes(priceId)) return "creator";
  if (studioPrices().includes(priceId)) return "studio";
  return null;
}

export function getFoundingTierFromPriceId(priceId: string): 1 | 2 | null {
  if (priceId === process.env.STRIPE_PRICE_FOUNDING_T1) return 1;
  if (priceId === process.env.STRIPE_PRICE_FOUNDING_T2) return 2;
  return null;
}

export function stripePeriodEndToIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

/** Stripe API 2025+ stores period end on subscription items, not the subscription root. */
export function getSubscriptionPeriodEnd(subscription: {
  items: { data: Array<{ current_period_end?: number }> };
}): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}
