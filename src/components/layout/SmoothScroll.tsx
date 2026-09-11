"use client";

import { ReactLenis } from "lenis/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Site-wide inertial scrolling.
 *
 * Lenis drives real window scroll (not a virtual transform), so
 * `window.scrollY`, anchor links and the 3D rig's scroll drift all keep
 * working. Disabled outright when the visitor asks for reduced motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.11,
        wheelMultiplier: 0.95,
        touchMultiplier: 1.6,
        // Trackpads already have momentum; smoothing them again feels laggy.
        syncTouch: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
