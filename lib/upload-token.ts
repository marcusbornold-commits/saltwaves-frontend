import "server-only";

import type { AccessLevel } from "@/lib/access-limits";
import { SignJWT } from "jose";

/**
 * The ticket both upload paths hand to the FastAPI service. Deliberately
 * coarser than {@link AccessLevel}: the backend only needs to know whether the
 * caller is a founding member, so plan changes here never break the verifier.
 *
 * Keep in sync with the backend's verifier — this is the whole contract.
 */
export type UploadTokenTier = "lifetime_creator" | "free";

const TOKEN_TTL = "10m";

export function tierForAccess(access: AccessLevel): UploadTokenTier {
  return access.isFounding ? "lifetime_creator" : "free";
}

/**
 * Returns null when UPLOAD_TOKEN_SECRET is unset. Both callers treat that as
 * "upload anonymously" rather than as a hard failure — losing the job's owner
 * is worse for the user than losing the upload, but only just, so it is logged
 * loudly on the way past.
 */
export async function signUploadToken(input: {
  userId: string;
  email: string | null;
  tier: UploadTokenTier;
}): Promise<string | null> {
  const secret = process.env.UPLOAD_TOKEN_SECRET;
  if (!secret) {
    console.error("UPLOAD_TOKEN_SECRET is not set — cannot mint upload tokens.");
    return null;
  }

  return new SignJWT({ email: input.email, tier: input.tier })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(new TextEncoder().encode(secret));
}
