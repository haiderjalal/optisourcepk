import { cn } from "@/lib/utils";
import type { CategorySlug } from "@/types/catalogue";

/**
 * Technical schematics drawn per category.
 *
 * The catalogue ships without product photography, and stock imagery would
 * misrepresent what is actually in the carton. Drawing the part instead —
 * lens section, frame front, bottle, flask, hardware, chart — keeps the
 * blueprint language of the brand and stays honest about the listing.
 */
export function ProductGlyph({
  category,
  className,
}: {
  category: CategorySlug;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "from-navy-800 to-navy-950 relative overflow-hidden rounded-xl bg-gradient-to-br",
        className,
      )}
      aria-hidden
    >
      <div className="grid-blueprint absolute inset-0 opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(37_99_235/0.22),transparent_62%)]" />
      <svg
        viewBox="0 0 200 140"
        className="relative h-full w-full"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className="text-silver-300/85">{SCHEMATICS[category]()}</g>
      </svg>
    </div>
  );
}

const AXIS = (
  <g className="text-accent-500/45" strokeDasharray="3 4" strokeWidth="1">
    <line x1="18" y1="70" x2="182" y2="70" />
  </g>
);

const SCHEMATICS: Record<CategorySlug, () => React.ReactNode> = {
  /* Biconvex lens in cross-section, with converging rays. */
  lenses: () => (
    <>
      {AXIS}
      <g strokeWidth="1.6">
        <path d="M92 32 C104 48 104 92 92 108 C80 92 80 48 92 32 Z" />
      </g>
      <g className="text-accent-500/70" strokeWidth="1.2">
        <path d="M24 44 L86 47 L150 66" />
        <path d="M24 70 L150 70" />
        <path d="M24 96 L86 93 L150 74" />
        <circle cx="152" cy="70" r="2.4" fill="currentColor" stroke="none" />
      </g>
      <g className="text-silver-400/50" strokeWidth="0.9">
        <line x1="92" y1="24" x2="92" y2="116" strokeDasharray="2 4" />
      </g>
    </>
  ),

  /* Frame front, plan view. */
  frames: () => (
    <>
      {AXIS}
      <g strokeWidth="1.6">
        <path d="M36 56 q0 26 24 26 t24 -26 q-24 -7 -48 0 Z" />
        <path d="M116 56 q0 26 24 26 t24 -26 q-24 -7 -48 0 Z" />
        <path d="M84 58 q16 -6 32 0" />
        <path d="M36 57 L18 50" />
        <path d="M164 57 L182 50" />
      </g>
      <g className="text-accent-500/60" strokeWidth="1">
        <line x1="36" y1="100" x2="84" y2="100" />
        <line x1="36" y1="96" x2="36" y2="104" />
        <line x1="84" y1="96" x2="84" y2="104" />
        <line x1="84" y1="100" x2="116" y2="100" strokeDasharray="2 3" />
      </g>
    </>
  ),

  /* Spray bottle + cloth. */
  accessories: () => (
    <>
      {AXIS}
      <g strokeWidth="1.6">
        <path d="M78 48 h18 v12 q10 6 10 18 v34 a6 6 0 0 1 -6 6 h-26 a6 6 0 0 1 -6 -6 v-34 q0 -12 10 -18 Z" />
        <path d="M78 42 h18 v6 h-18 Z" />
        <path d="M96 45 h14 l6 -8" />
      </g>
      <g className="text-accent-500/60" strokeWidth="1.2">
        <path d="M120 30 l6 -5 M128 36 l7 -3 M126 45 l8 1" />
      </g>
      <g strokeWidth="1.4" className="text-silver-400/70">
        <path d="M34 74 l22 -8 l14 22 l-22 8 Z" />
      </g>
    </>
  ),

  /* Flask and beaker — the tinting bench. */
  "lab-supplies": () => (
    <>
      {AXIS}
      <g strokeWidth="1.6">
        <path d="M84 34 h16 v24 l18 44 a6 6 0 0 1 -6 8 h-40 a6 6 0 0 1 -6 -8 l18 -44 Z" />
        <path d="M80 34 h24" />
      </g>
      <g className="text-accent-500/55" strokeWidth="1.4">
        <path d="M70 82 h44 l6 14 a6 6 0 0 1 -6 8 h-44 a6 6 0 0 1 -6 -8 Z" />
      </g>
      <g strokeWidth="1.4" className="text-silver-400/70">
        <path d="M134 56 h22 v46 h-22 Z" />
        <path d="M134 78 h22" />
        <path d="M134 88 h22" />
      </g>
    </>
  ),

  /* Screw and nose pad. */
  "frame-parts-tools": () => (
    <>
      {AXIS}
      <g strokeWidth="1.6">
        <path d="M54 54 h14 v-8 h10 v8 h14" />
        <path d="M68 46 v-8 h10 v8" />
        <path d="M73 54 v46" />
        <path d="M66 62 h14 M66 70 h14 M66 78 h14 M66 86 h14 M66 94 h14" />
      </g>
      <g strokeWidth="1.5" className="text-accent-500/60">
        <path d="M118 48 q22 4 20 28 q-2 24 -20 28 q-8 -28 0 -56 Z" />
        <circle cx="126" cy="62" r="3" />
      </g>
    </>
  ),

  /* Snellen chart. */
  optometric: () => (
    <>
      {AXIS}
      <g strokeWidth="1.5">
        <rect x="62" y="26" width="76" height="88" rx="4" />
      </g>
      <g className="text-silver-300/90" strokeWidth="2.4">
        <path d="M94 42 h12 M100 42 v10" />
      </g>
      <g className="text-silver-300/75" strokeWidth="1.8">
        <path d="M86 62 h10 M91 62 v7" />
        <path d="M104 62 h10 M109 62 v7" />
      </g>
      <g className="text-silver-300/55" strokeWidth="1.3">
        <path d="M80 80 h7 M92 80 h7 M104 80 h7 M116 80 h5" />
        <path d="M80 92 h5 M90 92 h5 M100 92 h5 M110 92 h5" />
      </g>
      <g className="text-accent-500/60" strokeWidth="1">
        <line x1="30" y1="118" x2="62" y2="118" strokeDasharray="3 3" />
        <line x1="138" y1="118" x2="170" y2="118" strokeDasharray="3 3" />
      </g>
    </>
  ),
};
