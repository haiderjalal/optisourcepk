"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const DURATION_MS = 1600;

function format(value: number, decimals: number): string {
  return value.toLocaleString("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * A figure that counts up once it scrolls into view.
 *
 * The server renders the final value, so crawlers and no-JavaScript readers
 * get the real number. On mount the count restarts from zero and runs when the
 * figure becomes visible. Readers who asked for reduced motion keep the static
 * value.
 */
export function CountUp({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion) return;

    setDisplay(0);
    let frame = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(value * eased);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reducedMotion]);

  const shown = reducedMotion ? value : display;

  return (
    <span ref={ref} className="tabular-nums">
      {format(shown, decimals)}
    </span>
  );
}
