import { auth } from "@/auth";
import { getFoundingCount, getFoundingTierInfo } from "@/lib/founding";
import type { Metadata } from "next";
import FoundingCheckoutButton from "./founding-checkout-button";
import "./founding.css";

export const metadata: Metadata = {
  alternates: { canonical: "/founding" },
  title: "Founding — Lifetime Creator Access | Saltwaves",
  description:
    "Lock in lifetime Creator access with a one-time payment. Limited to 20 founding members.",
};

type FoundingPageProps = {
  searchParams: Promise<{
    checkout?: string;
  }>;
};

const FOUNDING_FEATURES = [
  "Lifetime Creator plan",
  "10 hours of processing per month",
  "Priority processing",
  "Founding member badge",
];

export default async function FoundingPage({ searchParams }: FoundingPageProps) {
  const session = await auth();
  const { checkout } = await searchParams;
  let sold: number;
  try { sold = await getFoundingCount(); } catch {
    return <main className="founding-page"><div className="founding-shell">
      <h1 className="founding-title">Founding</h1>
      <p>20 places total, $129 once for lifetime Creator access. Checkout is temporarily unavailable while availability is verified.</p>
      <a href="/pricing">View monthly and annual plans</a>
    </div></main>;
  }
  const tierInfo = getFoundingTierInfo(sold);

  return (
    <main className="founding-page">
      <div className="founding-shell">
        {checkout === "cancel" && (
          <p className="founding-notice">Checkout cancelled. An unfinished checkout may hold a place until it expires.</p>
        )}

        <div className="founding-kicker">Founding membership</div>
        <h1 className="founding-title">Lock in lifetime Creator access.</h1>
        <p className="founding-sub">
          One payment of $129. Only 20 Founding memberships will be sold. Once all 20 are claimed, this offer closes.
        </p>

        <article className={`founding-card${tierInfo.soldOut ? " sold-out" : ""}`}>
          <p className="founding-counter">
            {tierInfo.sold} / {tierInfo.total} claimed
          </p>

          <ul className="founding-features">
            {FOUNDING_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>

          {tierInfo.soldOut ? (
            <p className="founding-sold-out-msg">All 20 spots claimed</p>
          ) : (
            <FoundingCheckoutButton
              tier={tierInfo.tier}
              priceId={tierInfo.priceId!}
              priceDisplay={tierInfo.priceDisplay!}
              spotLabel={tierInfo.spotLabel!}
              isLoggedIn={Boolean(session?.user)}
              soldOut={tierInfo.soldOut}
            />
          )}

          <p className="founding-tos">
            Lifetime applies to the Creator tier as defined today. Does not cover
            standalone future products. The RSS portal is not included.
          </p>
        </article>
      </div>
    </main>
  );
}
