"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Whether the visitor has asked for reduced motion.
 *
 * Four lines of `matchMedia` instead of pulling an animation library into a
 * component — which matters most in the root layout, where any import ships
 * on every page.
 *
 * Returns `false` during SSR so the server and the first client render agree;
 * CSS already suppresses motion for these users regardless.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
