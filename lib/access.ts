import "server-only";

import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Profile } from "@/types/profile";
import { redirect } from "next/navigation";

export type Plan = "free" | "creator" | "studio" | "founding";

export type AccessLevel = {
  plan: Plan;
  isPaid: boolean;
  isFounding: boolean;
  maxFileSizeMB: number;
  maxDurationMinutes: number;
};

const FREE_ACCESS: AccessLevel = {
  plan: "free",
  isPaid: false,
  isFounding: false,
  maxFileSizeMB: 200,
  maxDurationMinutes: 60,
};

const CREATOR_ACCESS: AccessLevel = {
  plan: "creator",
  isPaid: true,
  isFounding: false,
  maxFileSizeMB: 500,
  maxDurationMinutes: 180,
};

const FOUNDING_ACCESS: AccessLevel = {
  plan: "founding",
  isPaid: true,
  isFounding: true,
  maxFileSizeMB: 500,
  maxDurationMinutes: 180,
};

const STUDIO_ACCESS: AccessLevel = {
  plan: "studio",
  isPaid: true,
  isFounding: false,
  maxFileSizeMB: -1,
  maxDurationMinutes: -1,
};

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

function planToAccess(plan: Plan): AccessLevel {
  switch (plan) {
    case "founding":
      return FOUNDING_ACCESS;
    case "studio":
      return STUDIO_ACCESS;
    case "creator":
      return CREATOR_ACCESS;
    default:
      return FREE_ACCESS;
  }
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

  return planToAccess(resolvePlan(profile));
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
