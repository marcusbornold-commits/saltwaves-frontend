import { auth, signOut } from "@/auth";
import Logo from "@/components/Logo";
import ManageBillingButton from "@/components/ManageBillingButton";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";

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

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select(
      "subscription_status, lifetime_creator, founding_member_tier, current_period_end, stripe_customer_id",
    )
    .eq("id", session.user.id)
    .maybeSingle();

  const isLifetime = profile?.lifetime_creator === true;
  const subscriptionStatus = profile?.subscription_status as string | null;
  const foundingTier = profile?.founding_member_tier as number | null;
  const currentPeriodEnd = profile?.current_period_end as string | null;
  const stripeCustomerId = profile?.stripe_customer_id as string | null;

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
    <main className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <Logo />
        </div>

        {checkout === "success" && (
          <div className="account-banner">
            Payment successful — welcome to Saltwaves.
          </div>
        )}

        <h1 className="login-title">Your account</h1>
        <p className="login-sub">{session.user.email}</p>

        <div className="plan-card">
          <div className="plan-row">
            <span className="plan-name">{planName}</span>
            {planBadge && <span className="plan-badge">{planBadge}</span>}
          </div>
          {planMeta && <p className="plan-meta">{planMeta}</p>}
        </div>

        <div className="account-actions">
          {stripeCustomerId ? (
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
  );
}
