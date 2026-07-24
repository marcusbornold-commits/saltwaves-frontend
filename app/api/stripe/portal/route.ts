import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { getPortalReturnUrl } from "@/lib/stripe-helpers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to fetch profile for portal:", profileError.message);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }

  const stripeCustomerId = profile?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer found. Complete checkout first." },
      { status: 400 }
    );
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: getPortalReturnUrl(),
  });

  return NextResponse.json({ url: portalSession.url });
}
