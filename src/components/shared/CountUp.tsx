"use client";

import { useCallback, useRef } from "react";

function format(value: number, decimals: number): string {
  return value.toLocaleString("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Matches the ease used by the rest of the site's entrances. */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Counts to `value` the first time it scrolls into view.
 *
 * A bare `requestAnimationFrame` writing to the text node: no state (a number
 * re-rendering sixty times a second is a lot of React for nothing) and no
 * animation library, which keeps it off the homepage's critical path.
 *
 * The final value is what the server renders and what stays on screen under
 * reduced motion, so the figure is never missing or wrong.
 */
export function CountUp({
  value,
  duration = 1600,
  decimals = 0,
}: {
  value: number;
  /** Milliseconds. */
  duration?: number;
  decimals?: number;
}) {
  const frame = useRef<number | undefined>(undefined);

  const ref = useCallback(
    (node: HTMLSpanElement | null) => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (!node) return;

      if (
        typeof IntersectionObserver === "undefined" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        node.textContent = format(value, decimals);
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();

          const start = performance.now();
          const step = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            node.textContent = format(value * easeOutExpo(t), decimals);
            if (t < 1) frame.current = requestAnimationFrame(step);
          };
          frame.current = requestAnimationFrame(step);
        },
        { rootMargin: "0px 0px -60px 0px" },
      );

      observer.observe(node);
    },
    [value, duration, decimals],
  );

  return <span ref={ref}>{format(value, decimals)}</span>;
}
