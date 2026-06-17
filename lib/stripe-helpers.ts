import "server-only";

function appBaseUrl(): string {
  return process.env.AUTH_URL ?? "http://localhost:3000";
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
