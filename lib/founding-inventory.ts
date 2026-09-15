import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export type FoundingSlot = {
  slot: number;
  reservation_id: string;
  owner_id: string;
  customer_id: string;
  state: "available" | "held" | "sold";
  session_id: string | null;
  checkout_expires_at: number;
};
export class FoundingUnavailable extends Error {
  constructor(public code: "sold_out" | "already_member" | "unavailable") { super(code); }
}

export async function reconcileFoundingSlots(): Promise<void> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("founding_slots").select("*").eq("state", "held");
  if (error) throw new FoundingUnavailable("unavailable");
  for (const slot of (data ?? []) as FoundingSlot[]) {
    // Unknown outcomes stay reserved. Never release a place just because time passed.
    if (!slot.session_id) continue;
    const session = await getStripe().checkout.sessions.retrieve(slot.session_id);
    if (session.status === "expired") {
      const { error: updateError } = await db.from("founding_slots").update({
        state: "available", reservation_id: null, owner_id: null, customer_id: null,
        session_id: null, checkout_expires_at: null,
      }).eq("slot", slot.slot).eq("reservation_id", slot.reservation_id).eq("state", "held");
      if (updateError) throw new FoundingUnavailable("unavailable");
    } else if (session.status === "complete" && session.payment_status === "paid") {
      const { error: updateError } = await db.from("founding_slots").update({ state: "sold" })
        .eq("slot", slot.slot).eq("reservation_id", slot.reservation_id).eq("state", "held");
      if (updateError) throw new FoundingUnavailable("unavailable");
    }
    // A complete but unpaid async payment continues holding its place.
  }
}

export async function createFoundingCheckout(ownerId: string, customerId: string, priceId: string): Promise<string> {
  // Only the fixed $129 price is offered. Keep old price recognition for existing purchases/webhooks.
  if (priceId !== process.env.STRIPE_PRICE_FOUNDING_T1) throw new FoundingUnavailable("unavailable");
  await reconcileFoundingSlots();
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("reserve_founding_slot", { p_owner: ownerId, p_customer: customerId });
  if (error) throw new FoundingUnavailable("unavailable");
  const slot = data?.[0] as FoundingSlot | undefined;
  if (!slot) throw new FoundingUnavailable("sold_out");
  if (slot.state === "sold") throw new FoundingUnavailable("already_member");
  if (slot.session_id) {
    const session = await getStripe().checkout.sessions.retrieve(slot.session_id);
    if (session.status === "open" && session.url) return session.url;
    throw new FoundingUnavailable("unavailable");
  }
  // Persisted expiry + owner/customer + idempotency key make concurrent retries the same checkout.
  // An ambiguous Stripe error leaves the reservation held, avoiding overselling.
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: slot.customer_id,
    customer_update: { address: "auto", name: "auto" },
    client_reference_id: slot.owner_id,
    metadata: { user_id: slot.owner_id, price_id: priceId, founding_reservation: slot.reservation_id },
    line_items: [{ price: priceId, quantity: 1 }],
    invoice_creation: { enabled: true },
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    expires_at: slot.checkout_expires_at,
    success_url: "https://saltwaves.studio/account?checkout=success&founding=1",
    cancel_url: "https://saltwaves.studio/founding?checkout=cancel",
  }, { idempotencyKey: `founding-slot-${slot.reservation_id}` });
  const { error: updateError } = await db.from("founding_slots").update({ session_id: session.id })
    .eq("slot", slot.slot).eq("reservation_id", slot.reservation_id).eq("state", "held");
  if (updateError || !session.url) throw new FoundingUnavailable("unavailable");
  return session.url;
}

export async function foundingInventoryStatus(): Promise<{ sold: number; available: number }> {
  const db = getSupabaseAdmin();
  const { data: config, error: configError } = await db.from("founding_inventory").select("initialized").single();
  if (configError || !config?.initialized) throw new FoundingUnavailable("unavailable");
  await reconcileFoundingSlots();
  const { data, error } = await db.from("founding_slots").select("state");
  if (error || data?.length !== 20) throw new FoundingUnavailable("unavailable");
  return {
    sold: data.filter(slot => slot.state === "sold").length,
    available: data.filter(slot => slot.state === "available").length,
  };
}
