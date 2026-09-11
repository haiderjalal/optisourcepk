"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const MAX_TILT = 7; // degrees — enough to read as depth, not as a gimmick

/**
 * Pointer-tracked 3D tilt with a specular sheen that follows the cursor.
 *
 * Writes two CSS custom properties directly on pointermove and lets CSS do
 * the rest. No springs and no animation library: this wraps every category
 * card on the homepage, so its cost lands on the critical path.
 *
 * Purely decorative — the card's content stays a normal, focusable link.
 */
export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    node.style.setProperty("--tilt-y", `${(px - 0.5) * MAX_TILT * 2}deg`);
    node.style.setProperty("--tilt-x", `${(0.5 - py) * MAX_TILT * 2}deg`);
    node.style.setProperty("--glare-x", `${px * 100}%`);
    node.style.setProperty("--glare-y", `${py * 100}%`);
  }

  function handleLeave() {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--tilt-y", "0deg");
    node.style.setProperty("--tilt-x", "0deg");
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      data-tilt=""
      className={cn("relative", className)}
    >
      {children}
      <span data-tilt-glare="" aria-hidden />
    </div>
  );
}
