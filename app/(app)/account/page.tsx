import { auth, signOut } from "@/auth";
import ManageBillingButton from "@/components/ManageBillingButton";
import TrainingConsentToggle from "@/components/TrainingConsentToggle";
import { Nav } from "@/app/components/saltwaves-sections";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import "./account.css";

type AccountPageProps = {
  searchParams: Promise<{ checkout?: string }>;
};

function formatRenewDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { checkout } = await searchParams;

  const supabase = getSupabaseAdmin();

  let profile: {
    subscription_status: string | null;
    lifetime_creator: boolean | null;
    founding_member_tier: number | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
    training_data_consent: boolean | null;
  } | null = null;
  let profileError: { message: string } | null = null;

  {
    const result = await supabase
      .from("profiles")
      .select(
        "subscription_status, lifetime_creator, founding_member_tier, current_period_end, stripe_customer_id, training_data_consent",
      )
      .eq("id", session.user.id)
      .maybeSingle();

    if (
      result.error &&
      /training_data_consent/i.test(result.error.message)
    ) {
      // Column not applied yet — load billing fields only; treat consent as opt-out.
      const fallback = await supabase
        .from("profiles")
        .select(
          "subscription_status, lifetime_creator, founding_member_tier, current_period_end, stripe_customer_id",
        )
        .eq("id", session.user.id)
        .maybeSingle();
      if (fallback.error) {
        profileError = fallback.error;
        console.error(
          "Failed to fetch profile for account page:",
          fallback.error.message,
        );
      } else {
        profile = fallback.data
          ? { ...fallback.data, training_data_consent: null }
          : null;
      }
    } else if (result.error) {
      profileError = result.error;
      console.error(
        "Failed to fetch profile for account page:",
        result.error.message,
      );
    } else {
      profile = result.data;
    }
  }

  const isLifetime = profile?.lifetime_creator === true;
  const subscriptionStatus = profile?.subscription_status as string | null;
  const foundingTier = profile?.founding_member_tier as number | null;
  const currentPeriodEnd = profile?.current_period_end as string | null;
  const stripeCustomerId = profile?.stripe_customer_id as string | null;
  // null / missing / false = opt-out; only explicit true is consented.
  const trainingDataConsent = profile?.training_data_consent === true;

  let planName = "Free";
  let planBadge: string | null = null;
  const planMetaParts: string[] = [];

  if (isLifetime) {
    planName = "Founding Member";
    planBadge = "Lifetime Creator";
    if (foundingTier === 1 || foundingTier === 2) {
      planMetaParts.push(`Tier ${foundingTier}`);
    }
  } else if (subscriptionStatus === "studio") {
    planName = "Studio";
    planBadge = "Active";
  } else if (subscriptionStatus === "creator") {
    planName = "Creator";
    planBadge = "Active";
  }

  if (currentPeriodEnd && !isLifetime) {
    planMetaParts.push(`Renews ${formatRenewDate(currentPeriodEnd)}`);
  }

  const planMeta = planMetaParts.join(" · ");

  return (
    <>
      <Nav isLoggedIn />
      <main className="login-wrap account-wrap">
        <div className="login-card">
          {checkout === "success" && (
            <div className="account-banner">
              Payment successful — welcome to Saltwaves.
            </div>
          )}

          <h1 className="login-title">Your account</h1>
          <p className="login-sub">{session.user.email}</p>

          {profileError ? (
            <div className="account-banner is-error">
              We couldn&apos;t load your plan details right now. Refresh the page —
              if it keeps happening, email hello@saltwaves.studio and we&apos;ll
              sort it out.
            </div>
          ) : (
            <div className="plan-card">
              <div className="plan-row">
                <span className="plan-name">{planName}</span>
                {planBadge && <span className="plan-badge">{planBadge}</span>}
              </div>
              {planMeta && <p className="plan-meta">{planMeta}</p>}
            </div>
          )}

          {!profileError && (
            <TrainingConsentToggle initialConsent={trainingDataConsent} />
          )}

          <div className="account-actions">
            {/* Both actions depend on the profile — offering either after a failed
                read would be a guess about what the user has paid for. */}
            {profileError ? null : stripeCustomerId ? (
              <ManageBillingButton />
            ) : (
              <a href="/pricing" className="btn-primary-full">
                Upgrade your plan
              </a>
            )}

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="btn-google">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
