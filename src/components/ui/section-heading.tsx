import { cn } from "@/lib/utils";

/**
 * The brand's standard section lockup: eyebrow, electric-blue rule,
 * headline, optional lede. Used on every section so vertical rhythm and
 * type scale stay identical site-wide.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  inverted = false,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "left" | "center";
  inverted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto flex flex-col items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            "eyebrow",
            inverted ? "text-accent-400" : "text-accent-600",
          )}
        >
          {eyebrow}
        </p>
      )}
      <span className="brand-rule mt-4" />
      <h2
        className={cn(
          "mt-5 text-3xl leading-[1.1] font-bold sm:text-4xl lg:text-[2.75rem]",
          inverted && "text-white",
        )}
      >
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed sm:text-lg",
            inverted ? "text-silver-300" : "text-navy-500",
          )}
        >
          {lede}
        </p>
      )}
    </div>
  );
}
