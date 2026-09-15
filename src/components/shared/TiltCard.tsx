import { cn } from "@/lib/utils";

/** Static wrapper kept for layout compatibility without client hydration. */
export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("relative", className)}>{children}</div>;
}
