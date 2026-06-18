import {
  getFoundingTierFromPriceId,
  getPlanFromPriceId,
  getSubscriptionPeriodEnd,
  stripePeriodEndToIso,
} from "@/lib/stripe-helpers";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

async function getProfileByStripeCustomerId(stripeCustomerId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, lifetime_creator")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data;
}

async function handleCheckoutSessionCompleted(
  checkoutSession: Stripe.Checkout.Session,
) {
  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();
  const userId = checkoutSession.metadata?.user_id;
  const priceId = checkoutSession.metadata?.price_id;
  const stripeCustomerId = getStripeCustomerId(checkoutSession.customer);

  if (!userId || !priceId || !stripeCustomerId) {
    console.error("Missing checkout session metadata or customer", {
      userId,
      priceId,
      stripeCustomerId,
    });
    return;
  }

  if (checkoutSession.mode === "payment") {
    const tier = getFoundingTierFromPriceId(priceId);

    if (!tier) {
      console.error("Unknown founding member price:", priceId);
      return;
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        lifetime_creator: true,
        founding_member_tier: tier,
        subscription_status: "lifetime_creator",
        stripe_customer_id: stripeCustomerId,
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to update founding member profile: ${error.message}`);
    }

    return;
  }

  if (checkoutSession.mode === "subscription") {
    const subscriptionId =
      typeof checkoutSession.subscription === "string"
        ? checkoutSession.subscription
        : checkoutSession.subscription?.id;

    if (!subscriptionId) {
      console.error("Missing subscription on checkout session");
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentPriceId = subscription.items.data[0]?.price.id;
    const subscriptionStatus = getPlanFromPriceId(priceId);
    const periodEnd = getSubscriptionPeriodEnd(subscription);

    if (!subscriptionStatus) {
      console.error("Unknown subscription price:", priceId);
      return;
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_id: subscription.id,
        current_price_id: currentPriceId ?? priceId,
        subscription_status: subscriptionStatus,
        current_period_end: periodEnd
          ? stripePeriodEndToIso(periodEnd)
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        stripe_customer_id: stripeCustomerId,
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to update subscription profile: ${error.message}`);
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabaseAdmin = getSupabaseAdmin();
  const stripeCustomerId = getStripeCustomerId(subscription.customer);

  if (!stripeCustomerId) return;

  const profile = await getProfileByStripeCustomerId(stripeCustomerId);

  if (!profile) {
    console.error("No profile found for customer:", stripeCustomerId);
    return;
  }

  if (profile.lifetime_creator) return;

  const currentPriceId = subscription.items.data[0]?.price.id;

  if (!currentPriceId) {
    console.error("Subscription has no price item");
    return;
  }

  const subscriptionStatus = getPlanFromPriceId(currentPriceId);

  if (!subscriptionStatus) {
    console.error("Unknown subscription price:", currentPriceId);
    return;
  }

  const periodEnd = getSubscriptionPeriodEnd(subscription);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_id: subscription.id,
      current_price_id: currentPriceId,
      current_period_end: periodEnd ? stripePeriodEndToIso(periodEnd) : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      subscription_status: subscriptionStatus,
    })
    .eq("id", profile.id);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabaseAdmin = getSupabaseAdmin();
  const stripeCustomerId = getStripeCustomerId(subscription.customer);

  if (!stripeCustomerId) return;

  const profile = await getProfileByStripeCustomerId(stripeCustomerId);

  if (!profile) {
    console.error("No profile found for customer:", stripeCustomerId);
    return;
  }

  if (profile.lifetime_creator) return;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_id: null,
      current_price_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
      subscription_status: "free",
    })
    .eq("id", profile.id);

  if (error) {
    throw new Error(`Failed to clear subscription: ${error.message}`);
  }
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Webhook handler failed for ${event.type}:`, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
