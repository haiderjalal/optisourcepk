import { LogoMark } from "@/components/shared/Logo";
import { BRAND_STATEMENTS } from "@/lib/site";

/**
 * The brand book's statement lines, running as a continuous band.
 * Rendered twice so the CSS translate can loop seamlessly at -50%.
 */
export function StatementMarquee() {
  const strip = [...BRAND_STATEMENTS, ...BRAND_STATEMENTS];

  return (
    <section
      className="border-navy-100 border-y bg-white py-5"
      aria-label="What OptiSource PK stands for"
    >
      <div className="mask-fade-x flex overflow-hidden">
        <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10 motion-reduce:animate-none">
          {strip.map((statement, index) => (
            <div
              key={`${statement}-${index}`}
              className="flex shrink-0 items-center gap-10"
            >
              <span className="eyebrow text-navy-400 whitespace-nowrap">
                {statement}
              </span>
              <LogoMark className="size-4 opacity-40" id={`mq-${index}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
