import { ArrowRight, BadgeCheck, Package, Truck } from "lucide-react";
import { HeroCanvas } from "@/components/three/HeroCanvas";
import { ButtonLink } from "@/components/ui/button";
import { SITE } from "@/lib/site";

const PROOF = [
  { icon: Truck, title: "Bulk supply ready", detail: "Nationwide dispatch" },
  { icon: BadgeCheck, title: "Verified batches", detail: "Power & coating QC" },
  { icon: Package, title: "Trade terms", detail: "Net 30 on approval" },
];

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden pt-16 pb-14 lg:min-h-[calc(100svh-6.5rem)] lg:pt-20">
      <HeroCanvas />

      {/* Legibility scrim — keeps the headline at AA over the WebGL layer */}
      <div
        className="absolute inset-0 bg-[linear-gradient(100deg,rgb(6_13_24/0.94)_0%,rgb(6_13_24/0.82)_38%,rgb(6_13_24/0.25)_66%,transparent_100%)]"
        aria-hidden
      />

      <div className="container-brand relative">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="brand-rule" />
            <p className="eyebrow text-accent-400">Wholesale Optical Supply</p>
          </div>

          <h1 className="font-display mt-7 text-[2.75rem] leading-[0.98] font-bold tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.5rem]">
            Quality vision,
            <br />
            <span className="text-silver-300">stronger together.</span>
          </h1>

          <p className="eyebrow text-silver-400 mt-5">{SITE.tagline}</p>

          <p className="text-silver-300 mt-7 max-w-xl text-base leading-relaxed sm:text-lg">
            Lenses, frames, lab consumables and exam-room equipment, supplied in
            depth to optical practices, glazing labs and retailers across
            Pakistan. One partner, one delivery, one invoice.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/inquiry" size="lg">
              Start a Trade Inquiry
              <ArrowRight
                className="size-4 transition-transform group-hover/btn:translate-x-1"
                aria-hidden
              />
            </ButtonLink>
            <ButtonLink href="/catalogue" variant="outlineInverted" size="lg">
              Browse the catalogue
            </ButtonLink>
          </div>

          <ul className="mt-12 grid gap-x-8 gap-y-5 sm:grid-cols-3">
            {PROOF.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-white/8 ring-1 ring-white/12 ring-inset">
                  <Icon className="text-accent-400 size-4" aria-hidden />
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold text-white">
                    {title}
                  </span>
                  <span className="text-silver-400 block text-xs">
                    {detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
