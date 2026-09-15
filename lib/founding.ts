import "server-only";
import { foundingInventoryStatus } from "@/lib/founding-inventory";
export type FoundingTier = "t1" | "sold_out";
export type FoundingTierInfo = {
  tier: FoundingTier; priceDisplay: string | null; priceId: string | null;
  spotLabel: string | null; soldOut: boolean; sold: number; total: number;
};
export const getFoundingStatus = foundingInventoryStatus;
export function getFoundingTierInfo(sold: number, available = Math.max(0, 20 - sold)): FoundingTierInfo {
  if (sold >= 20) return { tier: "sold_out", priceDisplay: null, priceId: null,
    spotLabel: null, soldOut: true, sold, total: 20 };
  const priceId = process.env.STRIPE_PRICE_FOUNDING_T1;
  if (!priceId) throw new Error("STRIPE_PRICE_FOUNDING_T1 is not configured");
  return { tier: "t1", priceDisplay: "$129", priceId,
    spotLabel: `${available} places available. A place is reserved when checkout starts.`, soldOut: false, sold, total: 20 };
}
