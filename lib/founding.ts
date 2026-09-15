import "server-only";
import { foundingInventoryCount } from "@/lib/founding-inventory";
export type FoundingTier = "t1" | "sold_out";
export type FoundingTierInfo = {
  tier: FoundingTier; priceDisplay: string | null; priceId: string | null;
  spotLabel: string | null; soldOut: boolean; sold: number; total: number;
};
export const getFoundingCount = foundingInventoryCount;
export function getFoundingTierInfo(sold: number): FoundingTierInfo {
  if (sold >= 20) return { tier: "sold_out", priceDisplay: null, priceId: null,
    spotLabel: null, soldOut: true, sold, total: 20 };
  const priceId = process.env.STRIPE_PRICE_FOUNDING_T1;
  if (!priceId) throw new Error("STRIPE_PRICE_FOUNDING_T1 is not configured");
  return { tier: "t1", priceDisplay: "$129", priceId,
    spotLabel: "20 places total. Availability is checked at checkout.", soldOut: false, sold, total: 20 };
}
