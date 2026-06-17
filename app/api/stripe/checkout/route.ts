import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import {
  getCheckoutCancelUrl,
  getCheckoutSuccessUrl,
  isAllowedPriceId,
  isFoundingPriceId,
} from "@/lib/stripe-helpers";

type CheckoutBody = {
  price_id?: string;
};

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const priceId = body.price_id;
  if (!priceId || typeof priceId !== "string") {
    return NextResponse.json({ error: "price_id is required" }, { status: 400 });
  }

  if (!isAllowedPriceId(priceId)) {
    return NextResponse.json({ error: "Invalid price_id" }, { status: 400 });
  }

  const founding = isFoundingPriceId(priceId);
  const stripe = getStripe();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: founding ? "payment" : "subscription",
    customer_email: session.user.email,
    client_reference_id: session.user.id,
    metadata: {
      user_id: session.user.id,
    },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: getCheckoutSuccessUrl(founding),
    cancel_url: getCheckoutCancelUrl(founding),
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: checkoutSession.url });
}
