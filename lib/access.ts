import "server-only";

import { auth } from "@/auth";
import {
  FREE_ACCESS,
  PLAN_LIMITS,
  type AccessLevel,
  type Plan,
} from "@/lib/access-limits";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Profile } from "@/types/profile";
import { redirect } from "next/navigation";

export type { AccessLevel, Plan };

function resolvePlan(profile: Profile): Plan {
  if (profile.lifetime_creator === true) {
    return "founding";
  }

  if (profile.subscription_status === "studio") {
    return "studio";
  }

  if (profile.subscription_status === "creator") {
    return "creator";
  }

  return "free";
}

export async function getAccess(userId: string): Promise<AccessLevel> {
  const supabase = getSupabaseAdmin();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, subscription_status, subscription_id, lifetime_creator, founding_member_tier, current_price_id, current_period_end, cancel_at_period_end, stripe_customer_id",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch profile for user ${userId}: ${error.message}`);
  }

  if (!profile) {
    return FREE_ACCESS;
  }

  return PLAN_LIMITS[resolvePlan(profile)];
}

/**
 * For public pages. Anonymous visitors get the free tier instead of a redirect.
 *
 * Advisory only: a failed profile read degrades to free rather than taking the
 * page down, so the worst case is a paying customer briefly seeing free limits
 * in the UI. The upload path re-resolves the level server-side and is the
 * authority — it returns 503 rather than enforcing a level it could not read.
 */
export async function getAccessForSession(): Promise<AccessLevel> {
  const session = await auth();

  if (!session?.user?.id) {
    return FREE_ACCESS;
  }

  try {
    return await getAccess(session.user.id);
  } catch (error) {
    console.error("Falling back to free limits, profile read failed:", error);
    return FREE_ACCESS;
  }
}

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

export async function requireAccess(): Promise<AccessLevel> {
  const user = await requireAuth();
  return getAccess(user.id);
}
