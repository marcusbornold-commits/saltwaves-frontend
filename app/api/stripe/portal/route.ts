import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to fetch profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 },
      );
    }

    const stripeCustomerId = profile?.stripe_customer_id as string | null;

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No Stripe customer for this user yet. Complete a purchase first.",
        },
        { status: 400 },
      );
    }

    const origin =
      req.headers.get("origin") ??
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
      req.nextUrl.origin;

    const protocol = req.headers.get("x-forwarded-proto") ?? "https";
    const baseUrl = origin.startsWith("http")
      ? origin
      : `${protocol}://${origin}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/account`,
    });

    if (!portalSession.url) {
      return NextResponse.json(
        { error: "Stripe did not return a portal URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Stripe portal error:", error);

    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : "Failed to create billing portal session";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
