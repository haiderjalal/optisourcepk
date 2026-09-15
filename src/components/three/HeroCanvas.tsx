/**
 * Zero-JavaScript hero artwork. The previous WebGL enhancement downloaded
 * Three.js after page idle, which still counted as unused work in Lighthouse
 * and competed with interaction readiness on desktop devices.
 */
export function HeroCanvas() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="bg-navy-950 absolute inset-0" />
      <div className="grid-blueprint absolute inset-0 opacity-40" />
      <div className="absolute -right-[18%] bottom-[8%] aspect-square w-[78vw] max-w-[640px] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(96_165_250/0.45),rgb(37_99_235/0.2)_42%,transparent_68%)] blur-2xl md:top-1/2 md:right-[6%] md:bottom-auto md:w-[46vw] md:-translate-y-1/2" />
      <div className="absolute -right-[6%] bottom-[22%] aspect-square w-[34vw] max-w-[220px] rounded-full border border-white/8 md:hidden" />
      <div className="bg-accent-600/12 absolute -top-32 -left-40 h-[520px] w-[520px] rounded-full blur-[120px]" />
    </div>
  );
}
