import { auth } from "@/auth";
import { getFoundingCount, getFoundingTierInfo } from "@/lib/founding";
import FoundingCheckoutButton from "./founding-checkout-button";
import "./founding.css";

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
  const sold = await getFoundingCount();
  const tierInfo = getFoundingTierInfo(sold);

  return (
    <main className="founding-page">
      <div className="founding-shell">
        {checkout === "cancel" && (
          <p className="founding-notice">Checkout cancelled. Your spot is still available.</p>
        )}

        <div className="founding-kicker">Founding presale</div>
        <h1 className="founding-title">Lock in lifetime Creator access.</h1>
        <p className="founding-sub">
          One-time payment. Limited to 20 founding members — tier pricing increases as spots fill.
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
            Livstid gäller Creator-nivån som den är definierad idag. Gäller ej
            framtida fristående produkter. RSS-portalen ingår inte.
          </p>
        </article>
      </div>
    </main>
  );
}
