"use client";

import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** How far the card turns at its edges, in degrees. */
const MAX_TILT_DEG = 10;

/**
 * A card that turns toward the pointer in 3D, with a glare that follows it.
 *
 * The pointer position goes straight into CSS custom properties, so the card
 * never re-renders. Only a mouse tilts it: touch and pen get the flat card.
 * The motion itself is in `.tilt-card` (globals.css), which also switches it
 * off for readers who asked for reduced motion.
 */
export function TiltCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;

    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Pointer at the top tips the card back; at the right it turns to the left.
    card.style.setProperty(
      "--tilt-x",
      `${((0.5 - y) * 2 * MAX_TILT_DEG).toFixed(2)}deg`,
    );
    card.style.setProperty(
      "--tilt-y",
      `${((x - 0.5) * 2 * MAX_TILT_DEG).toFixed(2)}deg`,
    );
    card.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div
      className={cn("tilt-card rounded-card", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
      <span className="tilt-glare" aria-hidden />
    </div>
  );
}
