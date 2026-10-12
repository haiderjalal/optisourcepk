import { cn } from "@/lib/utils";

/**
 * Scroll-reveal wrappers.
 *
 * The motion itself is CSS (`.reveal` and `.stagger` in globals.css): no
 * client component, no hydration cost, and nothing hidden in the markup when a
 * browser cannot drive it from scroll. Parents sit between `Stagger` and
 * `StaggerItem` so siblings enter one after another.
 */

type RevealTag = "div" | "li" | "section" | "span";

export function Reveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: RevealTag;
}) {
  return <Tag className={cn("reveal", className)}>{children}</Tag>;
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
  return <Tag className={cn("stagger", className)}>{children}</Tag>;
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
  return <Tag className={cn("reveal", className)}>{children}</Tag>;
}
