import { cn } from "@/lib/utils";

/**
 * The OptiSource PK eye mark, rebuilt as vector geometry.
 *
 * Two interlocking crescents (navy + logo silver) spiral around a central
 * iris — the aperture motif used across the brand book. Drawn on a 100×100
 * grid and tilted -28° to match the printed lockup.
 */
export function LogoMark({
  className,
  tone = "colour",
  id = "mark",
}: {
  className?: string;
  /** `colour` = navy + silver. `mono` = inherits currentColor. */
  tone?: "colour" | "mono";
  /** Unique per-instance so gradient ids never collide. */
  id?: string;
}) {
  const gradientId = `os-${id}-crescent`;
  const mono = tone === "mono";

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="OptiSource PK"
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2f4a76" />
          <stop offset="100%" stopColor="#16294a" />
        </linearGradient>
      </defs>

      <g transform="rotate(-28 50 50)">
        {/* Upper crescent — navy */}
        <path
          d="M8 50 A42 42 0 0 1 92 50 A21 21 0 0 1 50 50 A21 21 0 0 0 8 50 Z"
          fill={mono ? "currentColor" : `url(#${gradientId})`}
        />
        {/* Lower crescent — logo silver */}
        <path
          d="M92 50 A42 42 0 0 1 8 50 A21 21 0 0 1 50 50 A21 21 0 0 0 92 50 Z"
          fill={mono ? "currentColor" : "#8fa0bc"}
          opacity={mono ? 0.45 : 1}
        />
        {/* Iris */}
        <circle
          cx="50"
          cy="50"
          r="15"
          fill={mono ? "currentColor" : "#10203a"}
        />
        {/* Pupil highlight */}
        <circle cx="50" cy="50" r="8.5" fill="#ffffff" />
      </g>
    </svg>
  );
}

/**
 * Full brand lockup: mark + wordmark + descriptor.
 * `compact` drops the descriptor for tight bars.
 */
export function Logo({
  className,
  inverted = false,
  compact = false,
  id,
}: {
  className?: string;
  /** Use on navy backgrounds. */
  inverted?: boolean;
  compact?: boolean;
  id?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9" id={id} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.075rem] font-bold tracking-[0.02em] whitespace-nowrap",
            inverted ? "text-white" : "text-navy-700",
          )}
        >
          OPTISOURCE{" "}
          <span className={inverted ? "text-silver-300" : "text-silver-400"}>
            PK
          </span>
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-[3px] text-[0.5rem] font-semibold tracking-[0.28em]",
              inverted ? "text-silver-300/80" : "text-silver-500",
            )}
          >
            THE OPTICAL SUPPLY
          </span>
        )}
      </span>
    </span>
  );
}
