"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

/** Cheap, honest WebGL2 probe — cached for the life of the page. */
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Gate for the hero's WebGL layer.
 *
 * The scene only mounts once the page is interactive, the device reports
 * WebGL, and the viewport is wide enough to be worth the battery. Anything
 * that fails those checks keeps the CSS fallback, which is a complete
 * composition in its own right — never an empty box.
 */
export function HeroCanvas() {
  const reduced = usePrefersReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!supportsWebGL()) return;
    // Phones get the static gradient: the transmission pass is not worth
    // the thermal budget on a 6" screen.
    const wideEnough = window.matchMedia("(min-width: 768px)").matches;
    if (!wideEnough) return;

    // Wait for the main thread to go quiet so the scene never competes
    // with the first paint.
    const start = () => setEnabled(true);
    const hasIdle = "requestIdleCallback" in window;
    const handle = hasIdle
      ? window.requestIdleCallback(start, { timeout: 1200 })
      : window.setTimeout(start, 400);

    return () => {
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Fallback / first paint — a full composition, not a placeholder. */}
      <div className="bg-navy-950 absolute inset-0" />
      <div className="grid-blueprint absolute inset-0 opacity-40" />
      {/* A lens-shaped bloom — the same optic the WebGL layer renders, so
          phones (which never load the canvas) still get the composition. */}
      <div className="absolute -right-[18%] bottom-[8%] aspect-square w-[78vw] max-w-[640px] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(96_165_250/0.45),rgb(37_99_235/0.2)_42%,transparent_68%)] blur-2xl md:top-1/2 md:right-[6%] md:bottom-auto md:w-[46vw] md:-translate-y-1/2" />
      <div className="absolute -right-[6%] bottom-[22%] aspect-square w-[34vw] max-w-[220px] rounded-full border border-white/8 md:hidden" />
      <div className="bg-accent-600/12 absolute -top-32 -left-40 h-[520px] w-[520px] rounded-full blur-[120px]" />

      {enabled && (
        <div className="animate-fade-in absolute inset-0">
          <HeroScene reduced={Boolean(reduced)} />
        </div>
      )}
    </div>
  );
}
