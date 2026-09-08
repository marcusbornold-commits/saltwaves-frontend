"use client";

import { useEffect, useState } from "react";

export type BackendHealth = "unknown" | "up" | "down";

const HEALTH_TIMEOUT_MS = 4000;
const RECHECK_INTERVAL_MS = 60_000;

export const BACKEND_DOWN_MESSAGE =
  "Uploads are temporarily unavailable. Nothing was uploaded — try again shortly.";

/**
 * Checks the active upload destination. Supabase uploads remain available while
 * the audio worker is offline; legacy uploads still require FastAPI health.
 * Resolves "down" on any network failure, non-2xx, or timeout. Never throws.
 */
export async function checkBackendHealth(): Promise<BackendHealth> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");


  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const configResponse = await fetch('/api/queue/health', {cache: 'no-store', signal: controller.signal});
    if (!configResponse.ok) return 'down';
    const config = await configResponse.json();
    if (config.backend === 'supabase') return config.ok ? 'up' : 'down';
    if (!apiBase) return 'down';
    const res = await fetch(`${apiBase}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok ? "up" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks once on mount, then every minute while the tab is visible, and again
 * when the tab regains focus. Starts as "unknown" so the UI never flashes an
 * outage message before the first answer has arrived.
 */
export function useBackendHealth(): {
  health: BackendHealth;
  recheck: () => Promise<BackendHealth>;
} {
  const [health, setHealth] = useState<BackendHealth>("unknown");

  const recheck = async () => {
    const next = await checkBackendHealth();
    setHealth(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next = await checkBackendHealth();
      if (!cancelled) setHealth(next);
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
