import "server-only";
import { getStripe } from "@/lib/stripe";

export type FoundingTier = "t1" | "t2" | "sold_out";

export type FoundingTierInfo = {
  tier: FoundingTier;
  priceDisplay: string | null;
  priceId: string | null;
  spotLabel: string | null;
  soldOut: boolean;
  sold: number;
  total: number;
};

function getFoundingPriceIds(): Set<string> {
  return new Set(
    [process.env.STRIPE_PRICE_FOUNDING_T1, process.env.STRIPE_PRICE_FOUNDING_T2].filter(
      (id): id is string => Boolean(id)
    )
  );
}

function lineItemPriceId(
  price: string | { id: string } | null | undefined
): string | null {
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

export async function getFoundingCount(): Promise<number> {
  const stripe = getStripe();
  const foundingPriceIds = getFoundingPriceIds();
  let count = 0;
  let startingAfter: string | undefined;

  while (true) {
    const page = await stripe.checkout.sessions.list({
      limit: 100,
      starting_after: startingAfter,
      status: "complete",
      expand: ["data.line_items"],
    });

    for (const session of page.data) {
      if (session.payment_status !== "paid") continue;

      const items = session.line_items?.data ?? [];
      const isFoundingPurchase = items.some((item) => {
        const priceId = lineItemPriceId(item.price);
        return priceId !== null && foundingPriceIds.has(priceId);
      });

      if (isFoundingPurchase) {
        count += 1;
      }
    }

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return count;
}

export function getFoundingTierInfo(sold: number): FoundingTierInfo {
  if (sold >= 100) {
    return {
      tier: "sold_out",
      priceDisplay: null,
      priceId: null,
      spotLabel: null,
      soldOut: true,
      sold,
      total: 100,
    };
  }

  if (sold < 50) {
    const priceId = process.env.STRIPE_PRICE_FOUNDING_T1;
    if (!priceId) {
      throw new Error("STRIPE_PRICE_FOUNDING_T1 is not configured");
    }

    return {
      tier: "t1",
      priceDisplay: "$129",
      priceId,
      spotLabel: `Plats ${sold + 1} av 50`,
      soldOut: false,
      sold,
      total: 100,
    };
  }

  const priceId = process.env.STRIPE_PRICE_FOUNDING_T2;
  if (!priceId) {
    throw new Error("STRIPE_PRICE_FOUNDING_T2 is not configured");
  }

  return {
    tier: "t2",
    priceDisplay: "$149",
    priceId,
    spotLabel: `Plats ${sold + 1} av 100`,
    soldOut: false,
    sold,
    total: 100,
  };
}
