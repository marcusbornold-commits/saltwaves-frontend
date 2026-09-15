"use client";

import { useState } from "react";
import { startCheckout } from "@/lib/checkout-client";

type FoundingTier = "t1" | "sold_out";

type FoundingCheckoutButtonProps = {
  tier: FoundingTier;
  priceId: string;
  priceDisplay: string;
  spotLabel: string;
  isLoggedIn: boolean;
  soldOut: boolean;
};

export default function FoundingCheckoutButton({
  tier,
  priceId,
  priceDisplay,
  spotLabel,
  isLoggedIn,
  soldOut,
}: FoundingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (soldOut) {
    return <p className="founding-sold-out-msg">All 20 spots claimed</p>;
  }

  async function handleClick() {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent("/founding");
      window.location.href = `/login?callbackUrl=${callbackUrl}`;
      return;
    }

    setError("");
    setLoading(true);
    try {
      await startCheckout(priceId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Checkout is unavailable. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <p className="founding-spot">{spotLabel}</p>
      <div className="founding-price">
        {priceDisplay} <small>one-time</small>
      </div>
      <button
        type="button"
        className="founding-btn"
        disabled={loading}
        onClick={handleClick}
        data-tier={tier}
      >
        {loading ? "Redirecting…" : `Get Founding — ${priceDisplay}`}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
