import { LogoMark } from "./LogoMark";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export { LogoMark };

/**
 * Full brand lockup: mark over wordmark, matching the supplied artwork —
 * OPTISOURCE in bold with PK in the lighter grey, the descriptor
 * wide-tracked beneath.
 *
 * `orientation="stacked"` reproduces the printed lockup (mark centred above
 * the type); `"inline"` is the horizontal variant the header and footer use.
 */
export function Logo({
  className,
  inverted = false,
  compact = false,
  orientation = "inline",
}: {
  className?: string;
  /** Use on navy grounds. */
  inverted?: boolean;
  /** Drops the descriptor line, for tight bars. */
  compact?: boolean;
  orientation?: "inline" | "stacked";
}) {
  const stacked = orientation === "stacked";

  return (
    <span
      className={cn(
        "flex",
        stacked ? "flex-col items-center gap-4" : "items-center gap-2.5",
        className,
      )}
    >
      <LogoMark
        tone={inverted ? "inverted" : "colour"}
        className={stacked ? "w-24" : "w-11"}
      />

      <span
        className={cn("flex flex-col leading-none", stacked && "items-center")}
      >
        <span
          className={cn(
            "font-display text-[1.075rem] font-bold tracking-[0.04em] whitespace-nowrap",
            stacked && "text-2xl tracking-[0.08em]",
            inverted ? "text-white" : "text-navy-700",
          )}
        >
          OPTISOURCE{" "}
          <span
            className={cn(
              "font-medium",
              inverted ? "text-silver-300" : "text-silver-400",
            )}
          >
            PK
          </span>
        </span>

        {!compact && (
          <span
            className={cn(
              "mt-[3px] text-[0.5rem] font-semibold tracking-[0.3em]",
              stacked && "mt-2 text-[0.625rem]",
              inverted ? "text-silver-300/80" : "text-silver-500",
            )}
          >
            {SITE.descriptor.toUpperCase()}
          </span>
        )}
      </span>
    </span>
  );
}
