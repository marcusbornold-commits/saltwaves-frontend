/**
 * Client-safe Distans demo limits + English error copy.
 */

import type { AccessLevel } from "@/lib/access-limits";

/** 2 GB / 1 hour — demo product limits, not a B2C plan row. */
export const DISTANS_DEMO_ACCESS: AccessLevel = {
  plan: "studio",
  label: "Distans demo",
  isPaid: true,
  isFounding: false,
  maxFileSizeMB: 2048,
  maxDurationMinutes: 60,
  maxMinutesPerMonth: 60,
};

export const DISTANS_DEMO_TOOL = "distans_demo";

export function distansDemoFileSizeError(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const actual =
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
  return `This file is ${actual}. The Distans demo limit is 2 GB.`;
}

export function distansDemoDurationError(seconds: number): string {
  return `This file is ${Math.round(seconds / 60)} minutes. The Distans demo limit is 1 hour. Please upload a shorter raw single-track file.`;
}
