import "server-only";

import { getPriceIdsFromEnv } from "@/lib/pricing";

function appBaseUrl(): string {
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

export function getAllowedPriceIds(): Set<string> {
  return new Set(
    [
      process.env.STRIPE_PRICE_CREATOR_MONTHLY,
      process.env.STRIPE_PRICE_CREATOR_YEARLY,
      process.env.STRIPE_PRICE_STUDIO_MONTHLY,
      process.env.STRIPE_PRICE_STUDIO_YEARLY,
      process.env.STRIPE_PRICE_FOUNDING_T1,
      process.env.STRIPE_PRICE_FOUNDING_T2,
    ].filter((id): id is string => Boolean(id))
  );
}

export function isAllowedPriceId(priceId: string): boolean {
  return getAllowedPriceIds().has(priceId);
}

export function isFoundingPriceId(priceId: string): boolean {
  return (
    priceId === process.env.STRIPE_PRICE_FOUNDING_T1 ||
    priceId === process.env.STRIPE_PRICE_FOUNDING_T2
  );
}

export function getCheckoutSuccessUrl(founding: boolean): string {
  if (founding) {
    return `${appBaseUrl()}/account?checkout=success&founding=1`;
  }
  return `${appBaseUrl()}/account?checkout=success`;
}

export function getCheckoutCancelUrl(founding: boolean): string {
  if (founding) {
    return `${appBaseUrl()}/founding?checkout=cancel`;
  }
  return `${appBaseUrl()}/pricing?checkout=cancel`;
}

export type PlanSlug = "creator" | "studio";

export function getPlanFromPriceId(priceId: string): PlanSlug | null {
  try {
    const ids = getPriceIdsFromEnv();
    if (priceId === ids.creatorMonthly || priceId === ids.creatorYearly) {
      return "creator";
    }
    if (priceId === ids.studioMonthly || priceId === ids.studioYearly) {
      return "studio";
    }
  } catch {
    return null;
  }
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
