// Client-safe on purpose. The numbers live here rather than in lib/access.ts,
// so the browser, the upload proxy and the error copy all read one table
// instead of drifting copies. lib/access.ts owns the database lookup that
// decides *which* row applies; this file decides what that row grants.

export type Plan = "free" | "creator" | "founding" | "studio";

export type AccessLevel = {
  plan: Plan;
  label: string;
  isPaid: boolean;
  isFounding: boolean;
  maxFileSizeMB: number;
  maxDurationMinutes: number;
};

export const PLAN_LIMITS: Record<Plan, AccessLevel> = {
  free: {
    plan: "free",
    label: "Free",
    isPaid: false,
    isFounding: false,
    maxFileSizeMB: 500,
    maxDurationMinutes: 60,
  },
  creator: {
    plan: "creator",
    label: "Creator",
    isPaid: true,
    isFounding: false,
    maxFileSizeMB: 500,
    maxDurationMinutes: 180,
  },
  // Founding is the Creator tier for life — identical ceilings, deliberately.
  founding: {
    plan: "founding",
    label: "Founding",
    isPaid: true,
    isFounding: true,
    maxFileSizeMB: 500,
    maxDurationMinutes: 180,
  },
  studio: {
    plan: "studio",
    label: "Studio",
    isPaid: true,
    isFounding: false,
    maxFileSizeMB: 1024,
    maxDurationMinutes: 300,
  },
};

export const FREE_ACCESS = PLAN_LIMITS.free;

/**
 * The upload token only distinguishes founding members from everyone else —
 * that is all the backend needs to know. Coarser than {@link Plan}, so it can
 * only ever be read alongside the session-resolved level, never instead of it.
 */
export function accessForTokenTier(
  tier: "lifetime_creator" | "free",
): AccessLevel {
  return tier === "lifetime_creator" ? PLAN_LIMITS.founding : FREE_ACCESS;
}

/**
 * Picks the more generous of two levels, whole — never a blend, because the
 * error copy names the level's own plan and a synthetic mix would name the
 * wrong one. Two sources feed the client-side check: the level rendered into
 * the page and the tier in the upload token. Erring generous keeps the browser
 * from rejecting a file the server would have accepted; the server re-resolves
 * the plan and stays the authority on what actually runs.
 */
export function morePermissive(a: AccessLevel, b: AccessLevel): AccessLevel {
  if (b.maxDurationMinutes !== a.maxDurationMinutes) {
    return b.maxDurationMinutes > a.maxDurationMinutes ? b : a;
  }
  return b.maxFileSizeMB > a.maxFileSizeMB ? b : a;
}

export function maxFileSizeBytes(level: AccessLevel): number {
  return level.maxFileSizeMB * 1024 * 1024;
}

export function exceedsFileSize(level: AccessLevel, bytes: number): boolean {
  return bytes > maxFileSizeBytes(level);
}

export function exceedsDuration(level: AccessLevel, seconds: number): boolean {
  return seconds > level.maxDurationMinutes * 60;
}

function limitLabel(mb: number): string {
  return mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`;
}

function actualLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/** Names the caller's own plan — never says "free plan" to a paying customer. */
export function fileSizeError(level: AccessLevel, bytes: number): string {
  return `This file is ${actualLabel(bytes)}. The limit on the ${level.label} plan is ${limitLabel(level.maxFileSizeMB)}.`;
}

export function durationError(level: AccessLevel, seconds: number): string {
  return `This episode is ${Math.round(seconds / 60)} minutes. The limit on the ${level.label} plan is ${level.maxDurationMinutes} minutes.`;
}
