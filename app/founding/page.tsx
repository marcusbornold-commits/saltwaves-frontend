import Link from "next/link";
import { auth } from "@/auth";
import Logo from "@/components/Logo";
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
  "Unlimited episodes",
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
        <div className="founding-top">
          <Link href="/">
            <Logo />
          </Link>
        </div>

        {checkout === "cancel" && (
          <p className="founding-notice">Checkout cancelled. Your spot is still available.</p>
        )}

        <div className="founding-kicker">Founding presale</div>
        <h1 className="founding-title">Lock in lifetime Creator access.</h1>
        <p className="founding-sub">
          One-time payment. Limited to 100 founding members — tier pricing increases as spots fill.
        </p>

        <article className={`founding-card${tierInfo.soldOut ? " sold-out" : ""}`}>
          <p className="founding-counter">
            {tierInfo.sold} / {tierInfo.total} sålda
          </p>

          <ul className="founding-features">
            {FOUNDING_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>

          {tierInfo.soldOut ? (
            <p className="founding-sold-out-msg">Alla 100 platser sålda</p>
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
            Lifetime Creator-plan. Gäller ej framtida fristående produkter.
          </p>
        </article>
      </div>
    </main>
  );
}
