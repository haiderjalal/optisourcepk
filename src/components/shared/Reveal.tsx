"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-triggered entrances.
 *
 * Deliberately IntersectionObserver + CSS rather than a motion library: these
 * are used on nearly every page, so anything imported here ships site-wide.
 * The components only toggle a `data-revealed` attribute; the transition
 * itself lives in `globals.css`, where `prefers-reduced-motion` already
 * neutralises it.
 */
function useRevealed(): {
  ref: (node: HTMLElement | null) => void;
  revealed: boolean;
} {
  const [revealed, setRevealed] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  // A callback ref rather than an object ref: it types cleanly across every
  // element the `as` prop allows, and attaches the moment the node exists.
  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;

    // No observer (a crawler, or a very old browser) — show it immediately.
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const next = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRevealed(true);
        next.disconnect();
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    next.observe(node);
    observer.current = next;
  }, []);

  return { ref, revealed };
}

type RevealTag = "div" | "li" | "section" | "span";

export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds. */
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
  as?: RevealTag;
}) {
  const { ref, revealed } = useRevealed();

  return (
    <Tag
      ref={ref}
      data-reveal={direction}
      data-revealed={revealed ? "" : undefined}
      className={cn(className)}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </Tag>
  );
}

/** Reveals its direct children in sequence. Pair with `StaggerItem`. */
export function Stagger({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul";
}) {
  const { ref, revealed } = useRevealed();

  return (
    <Tag
      ref={ref}
      data-stagger=""
      data-revealed={revealed ? "" : undefined}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  return (
    <Tag data-reveal="up" className={cn(className)}>
      {children}
    </Tag>
  );
}
