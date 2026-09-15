import { cn } from "@/lib/utils";

type RevealTag = "div" | "li" | "section" | "span";

export function Reveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds. */
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
  as?: RevealTag;
}) {
  return <Tag className={cn(className)}>{children}</Tag>;
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
  return <Tag className={cn(className)}>{children}</Tag>;
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
  return <Tag className={cn(className)}>{children}</Tag>;
}
