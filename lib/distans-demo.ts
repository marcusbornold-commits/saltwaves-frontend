import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  DistansDemoLink,
  DistansDemoLinkPublic,
} from "@/types/distans-demo";

export {
  DISTANS_DEMO_ACCESS,
  DISTANS_DEMO_TOOL,
  distansDemoDurationError,
  distansDemoFileSizeError,
} from "@/lib/distans-demo-limits";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function isValidDistansDemoTokenFormat(token: string): boolean {
  return TOKEN_RE.test(token);
}

export async function getActiveDistansDemoLink(
  token: string,
): Promise<DistansDemoLink | null> {
  if (!isValidDistansDemoTokenFormat(token)) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("distans_demo_links")
    .select(
      "id, token, prospect_id, email, active, created_at, first_upload_at",
    )
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("distans_demo_links lookup failed:", error.message);
    throw new Error("demo_lookup_failed");
  }

  return (data as DistansDemoLink | null) ?? null;
}

export function toPublicDistansDemoLink(
  link: DistansDemoLink,
): DistansDemoLinkPublic {
  return {
    id: link.id,
    token: link.token,
    prospectEmail: link.email,
  };
}

/**
 * Sets first_upload_at once. Concurrent uploads race safely — only the first
 * write wins; later ones leave the timestamp unchanged.
 */
export async function markDistansDemoFirstUpload(
  linkId: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("distans_demo_links")
    .update({ first_upload_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("first_upload_at", null);

  if (error) {
    console.error("distans_demo first_upload_at update failed:", error.message);
  }
}
