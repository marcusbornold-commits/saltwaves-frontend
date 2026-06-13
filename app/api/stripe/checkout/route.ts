import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

type CheckoutMode = "subscription" | "payment";

interface CheckoutBody {
  priceId?: string;
  mode?: CheckoutMode;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as CheckoutBody;
    const { priceId, mode } = body;

    if (!priceId || !mode || (mode !== "subscription" && mode !== "payment")) {
      return NextResponse.json(
        { error: "Invalid request: priceId and mode are required" },
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required for checkout" },
        { status: 400 },
      );
    }

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

    let customerId = profile?.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, stripe_customer_id: customerId });

      if (updateError) {
        console.error("Failed to save stripe_customer_id:", updateError);
        return NextResponse.json(
          { error: "Failed to save Stripe customer" },
          { status: 500 },
        );
      }
    }

    const origin =
      req.headers.get("origin") ??
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
      req.nextUrl.origin;

    const protocol = req.headers.get("x-forwarded-proto") ?? "https";
    const baseUrl = origin.startsWith("http")
      ? origin
      : `${protocol}://${origin}`;

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_update: {
        address: "auto",
        name: "auto",
      },
      success_url: `${baseUrl}/account?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
      metadata: {
        user_id: userId,
        price_id: priceId,
      },
    };

    if (mode === "subscription") {
      checkoutParams.subscription_data = {
        metadata: { user_id: userId },
      };
    }

    const checkoutSession =
      await stripe.checkout.sessions.create(checkoutParams);

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : "Failed to create checkout session";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
