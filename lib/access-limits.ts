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
