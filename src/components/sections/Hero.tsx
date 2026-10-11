import Image from "next/image";
import { ArrowRight, BadgeCheck, Clock3, Package, Truck } from "lucide-react";
import lensPackaging from "../../../brandbook/image4.jpeg";
import { HeroCanvas } from "@/components/three/HeroCanvas";
import { LensFocus } from "@/components/shared/LensFocus";
import { ButtonLink } from "@/components/ui/button";
import { SITE } from "@/lib/site";

const PROOF = [
  { icon: Truck, title: "Bulk supply ready", detail: "Nationwide dispatch" },
  { icon: BadgeCheck, title: "Verified batches", detail: "Power & coating QC" },
  { icon: Package, title: "Trade terms", detail: "Net 30 on approval" },
];

/** Each entrance step lands a beat after the one before it. */
function enter(step: number): React.CSSProperties {
  return { animationDelay: `${step * 110}ms` };
}

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden pt-16 pb-14 lg:min-h-[calc(100svh-6.5rem)] lg:pt-20">
      <HeroCanvas />

      {/* Legibility scrim — keeps the headline at AA over the background */}
      <div
        className="absolute inset-0 bg-[linear-gradient(100deg,rgb(6_13_24/0.94)_0%,rgb(6_13_24/0.82)_40%,rgb(6_13_24/0.45)_70%,rgb(6_13_24/0.3)_100%)]"
        aria-hidden
      />

      <div className="container-brand relative grid items-center gap-14 lg:grid-cols-[1.3fr_0.85fr] lg:gap-16">
        <div className="max-w-2xl">
          <div
            className="motion-safe:animate-rise flex items-center gap-3"
            style={enter(0)}
          >
            <span className="brand-rule" />
            <p className="eyebrow text-accent-400">Wholesale Optical Supply</p>
          </div>

          <h1 className="font-display mt-7 text-[2.75rem] leading-[0.98] font-bold tracking-[-0.03em] text-white sm:text-6xl lg:text-[3.75rem] xl:text-[4.5rem]">
            <span className="motion-safe:animate-rise block" style={enter(1)}>
              Quality vision,
            </span>
            <span
              className="text-silver-300 motion-safe:animate-rise block"
              style={enter(2)}
            >
              stronger together.
            </span>
          </h1>

          <p
            className="eyebrow text-silver-400 motion-safe:animate-rise mt-5"
            style={enter(3)}
          >
            {SITE.tagline}
          </p>

          <p
            className="text-silver-300 motion-safe:animate-rise mt-7 max-w-xl text-base leading-relaxed sm:text-lg"
            style={enter(4)}
          >
            Lenses, frames, lab consumables and exam-room equipment, supplied in
            depth to optical practices, glazing labs and retailers across
            Pakistan. One partner, one delivery, one invoice.
          </p>

          <div
            className="motion-safe:animate-rise mt-9 flex flex-wrap items-center gap-3"
            style={enter(5)}
          >
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

          <ul className="mt-12 grid gap-x-6 gap-y-5 sm:grid-cols-3">
            {PROOF.map(({ icon: Icon, title, detail }, index) => (
              <li
                key={title}
                className="motion-safe:animate-rise flex items-start gap-3"
                style={enter(6 + index)}
              >
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

        <HeroVisual />
      </div>
    </section>
  );
}

/**
 * The lens packaging photograph with the focus graphic laid over it. Two
 * small cards float beside it with copy taken from the trade pages, not
 * new claims.
 */
function HeroVisual() {
  return (
    <figure
      className="motion-safe:animate-rise relative mx-auto w-full max-w-md lg:max-w-none"
      style={enter(3)}
    >
      <div className="motion-safe:float-bob relative">
        <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-[0_40px_90px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/15">
          <Image
            src={lensPackaging}
            alt="OptiSource PK lens packaging with lens blanks"
            placeholder="blur"
            sizes="(min-width: 1024px) 34rem, 100vw"
            className="aspect-[4/3] h-auto w-full object-cover"
          />
          <LensFocus className="text-accent-600 absolute top-1/2 left-1/2 aspect-square w-[72%] -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div
          className="motion-safe:float-bob shadow-lift-lg ring-navy-100 absolute -bottom-6 -left-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-inset sm:-left-8"
          style={{ animationDelay: "-2s" }}
        >
          <p className="text-navy-700 flex items-center gap-2 text-xs font-semibold">
            <Clock3 className="text-accent-600 size-4" aria-hidden />
            Written quotation
          </p>
          <p className="text-navy-400 mt-0.5 text-[0.6875rem]">
            Usually within one working day
          </p>
        </div>

        <div
          className="motion-safe:float-bob shadow-lift-lg ring-navy-100 absolute -top-5 -right-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-inset sm:-right-6"
          style={{ animationDelay: "-4s" }}
        >
          <p className="text-navy-700 flex items-center gap-2 text-xs font-semibold">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            Ex-stock or indent
          </p>
          <p className="text-navy-400 mt-0.5 text-[0.6875rem]">
            Marked on every listing
          </p>
        </div>
      </div>
    </figure>
  );
}
