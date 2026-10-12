/**
 * Hero background. Pure CSS, no JavaScript: a blueprint grid over navy, with
 * two soft glows that drift slowly. The drift is off for readers who asked for
 * reduced motion.
 *
 * The directory name is historical — this layer used to be a WebGL scene.
 */
export function HeroCanvas() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="bg-navy-950 absolute inset-0" />
      <div className="grid-blueprint absolute inset-0 opacity-40" />
      <div className="motion-safe:drift-glow bg-accent-600/25 absolute -top-32 -left-40 h-[520px] w-[520px] rounded-full blur-[120px]" />
      <div className="motion-safe:drift-glow absolute right-[-10%] bottom-[-10%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(96_165_250/0.22),rgb(37_99_235/0.08)_45%,transparent_70%)] blur-2xl" />
    </div>
  );
}
