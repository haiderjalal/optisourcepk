"use client";

import { ArrowLeftRight } from "lucide-react";
import type { SheetLayout } from "./orientation";

/** Flip a power grid between SPH down the side and SPH across the top. */
export function SwapLayoutButton({
  layout,
  onSwap,
}: {
  layout: SheetLayout;
  onSwap: () => void;
}) {
  const next =
    layout === "sph-down" ? "SPH across the top" : "SPH down the side";
  return (
    <button
      type="button"
      onClick={onSwap}
      title={`Show ${next}`}
      className="text-navy-600 hover:text-navy-800 inline-flex items-center gap-1.5 rounded-lg border border-mist-300 bg-white px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-mist-100"
    >
      <ArrowLeftRight className="size-3.5" aria-hidden />
      Swap SPH / CYL
      <span className="sr-only">— show {next}</span>
    </button>
  );
}
