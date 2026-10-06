"use client";

import { useEffect, useRef, useState } from "react";

export type BackendHealth = "unknown" | "up" | "down";

/** Per fetch — queue health and Mini `/health` each get their own budget. */
const PER_REQUEST_TIMEOUT_MS = 10_000;
/** Brief pause before the single retry on a failed probe. */
const RETRY_DELAY_MS = 400;
const RECHECK_INTERVAL_MS = 60_000;
/** UI "offline" only after this many consecutive failed probes. */
export const CONSECUTIVE_FAILURES_TO_MARK_DOWN = 2;

export const BACKEND_DOWN_MESSAGE =
  "Mastering is offline right now. Nothing was uploaded — try again in a little while.";

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function probeBackendOnce(): Promise<BackendHealth> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!apiBase) return "down";

  try {
    const queue = await fetchWithTimeout("/api/queue/health");
    if (!queue.ok) return "down";
    const config = await queue.json();
    if (config.transport === "storage") return "up";
    const res = await fetchWithTimeout(`${apiBase}/health`, { method: "GET" });
    return res.ok ? "up" : "down";
  } catch {
    return "down";
  }
}

/**
 * Pings queue health, then FastAPI `/health` through the public Funnel URL when
 * transport is Mini. Each request has its own timeout so a slow Funnel TLS
 * handshake cannot burn the whole budget. Retries once before returning "down".
 * Never throws.
 */
export async function checkBackendHealth(): Promise<BackendHealth> {
  const first = await probeBackendOnce();
  if (first === "up") return "up";
  await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return probeBackendOnce();
}

/**
 * Maps a probe result onto displayed health. A single failure never flips the
 * UI to "down"; recovery on any success is immediate.
 */
export function reduceBackendHealth(
  previous: BackendHealth,
  consecutiveFailures: number,
  result: BackendHealth,
): { health: BackendHealth; consecutiveFailures: number } {
  if (result === "up") {
    return { health: "up", consecutiveFailures: 0 };
  }
  const nextFailures = consecutiveFailures + 1;
  if (nextFailures >= CONSECUTIVE_FAILURES_TO_MARK_DOWN) {
    return { health: "down", consecutiveFailures: nextFailures };
  }
  // Keep prior "up" so one blip does not disable the dropzone; otherwise stay unknown.
  return {
    health: previous === "up" ? "up" : "unknown",
    consecutiveFailures: nextFailures,
  };
}

/**
 * Checks once on mount, then every minute while the tab is visible, and again
 * when the tab regains focus. Starts as "unknown" so the UI never flashes an
 * outage message before the first answer has arrived. Displayed "down" requires
 * consecutive failures; `recheck` still returns the latest probe so uploads
 * refuse when the backend is actually unreachable.
 */
export function useBackendHealth(): {
  health: BackendHealth;
  recheck: () => Promise<BackendHealth>;
} {
  const [health, setHealth] = useState<BackendHealth>("unknown");
  const healthRef = useRef<BackendHealth>("unknown");
  const failuresRef = useRef(0);

  const commit = (result: BackendHealth): BackendHealth => {
    // Compute outside setState so React Strict Mode cannot double-count failures.
    const resolved = reduceBackendHealth(
      healthRef.current,
      failuresRef.current,
      result,
    );
    healthRef.current = resolved.health;
    failuresRef.current = resolved.consecutiveFailures;
    setHealth(resolved.health);
    // Upload gate uses the raw probe (already retried), not the smoothed UI state.
    return result;
  };

  const recheck = async () => commit(await checkBackendHealth());

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const run = async () => {
      // Overlapping mount+focus (or interval) must not double-count one outage.
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await checkBackendHealth();
        if (!cancelled) commit(result);
      } finally {
        inFlight = false;
      }
    };

    void run();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, RECHECK_INTERVAL_MS);
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { health, recheck };
}
