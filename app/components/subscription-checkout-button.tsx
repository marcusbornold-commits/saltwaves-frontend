"use client";

import { useState } from "react";
import { startCheckout } from "@/lib/checkout-client";
import {
  getSubscriptionPriceId,
  type BillingPeriod,
  type PriceIds,
} from "@/lib/pricing";

type SubscriptionCheckoutButtonProps = {
  plan: "creator" | "studio";
  billing: BillingPeriod;
  priceIds: PriceIds;
  isLoggedIn: boolean;
  loginCallbackUrl: string;
  className: string;
  children: React.ReactNode;
};

export default function SubscriptionCheckoutButton({
  plan,
  billing,
  priceIds,
  isLoggedIn,
  loginCallbackUrl,
  className,
  children,
}: SubscriptionCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(loginCallbackUrl);
      window.location.href = `/login?callbackUrl=${callbackUrl}`;
      return;
    }

    const priceId = getSubscriptionPriceId(plan, billing, priceIds);
    setLoading(true);

    try {
      await startCheckout(priceId);
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={loading}
      onClick={handleClick}
      style={{ justifyContent: "center" }}
    >
      {loading ? "Redirecting…" : children}
    </button>
  );
}
