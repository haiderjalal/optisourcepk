"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

function format(value: number, decimals: number): string {
  return value.toLocaleString("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Counts to `value` the first time it scrolls into view.
 *
 * The tween writes straight to the text node rather than through state — a
 * number that re-renders sixty times a second is a lot of React for no
 * benefit. The final value is what the server renders and what stays on
 * screen under reduced motion, so the figure is never missing or wrong.
 */
export function CountUp({
  value,
  duration = 1.6,
  decimals = 0,
}: {
  value: number;
  duration?: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView || reduced) return;

    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest, decimals);
      },
      onComplete: () => {
        node.textContent = format(value, decimals);
      },
    });

    return () => controls.stop();
  }, [inView, reduced, value, duration, decimals]);

  return <span ref={ref}>{format(value, decimals)}</span>;
}
