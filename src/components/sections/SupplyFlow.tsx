import Image from "next/image";
import {
  ClipboardCheck,
  PackageCheck,
  ScanLine,
  Truck,
  type LucideIcon,
} from "lucide-react";
import warehouse from "../../../brandbook/image5.jpeg";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/Reveal";
import { SectionHeading } from "@/components/ui/section-heading";

interface Step {
  icon: LucideIcon;
  step: string;
  title: string;
  detail: string;
}

/** The four-stage flow printed on the warehouse roller banner. */
const STEPS: Step[] = [
  {
    icon: ClipboardCheck,
    step: "01",
    title: "Receive",
    detail:
      "Your order lands against your trade account with agreed pricing already applied — no re-quoting line by line.",
  },
  {
    icon: ScanLine,
    step: "02",
    title: "Pick",
    detail:
      "Barcode-picked from bin locations, with lens powers and coatings verified against the docket before the tray moves.",
  },
  {
    icon: PackageCheck,
    step: "03",
    title: "Pack",
    detail:
      "Packed to survive the trunk route — lenses in moulded trays, frames boxed, the whole consignment sealed and labelled.",
  },
  {
    icon: Truck,
    step: "04",
    title: "Dispatch",
    detail:
      "Same-day dispatch on stock lines booked before 15:00, with a tracking reference sent to your WhatsApp.",
  },
];

export function SupplyFlow() {
  return (
    <section className="bg-navy-900 relative overflow-hidden py-20 lg:py-28">
      <div className="grid-blueprint absolute inset-0 opacity-20" aria-hidden />
      <div
        className="bg-accent-600/10 absolute top-0 left-1/2 h-80 w-[900px] -translate-x-1/2 rounded-full blur-[140px]"
        aria-hidden
      />

      <div className="container-brand relative">
        <SectionHeading
          inverted
          align="center"
          eyebrow="How we supply"
          title="Receive. Pick. Pack. Dispatch."
          lede="The same four stages every consignment passes through, whether it is fifty pairs of stock lenses or a full practice fit-out."
        />

        <Reveal className="mt-14">
          <figure className="relative overflow-hidden rounded-[1.75rem] shadow-[0_40px_90px_-40px_rgb(0_0_0/0.8)] ring-1 ring-white/10">
            <Image
              src={warehouse}
              alt="Packing station in the OptiSource PK warehouse, with sealed cartons and mailers beside a receive, pick, pack, dispatch board"
              placeholder="blur"
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="aspect-[4/3] h-auto w-full object-cover sm:aspect-[16/9]"
            />
            <div
              className="from-navy-900/60 absolute inset-0 bg-gradient-to-t via-transparent to-transparent"
              aria-hidden
            />
          </figure>
        </Reveal>

        <div className="relative mt-16">
          {/* Rail — draws itself as the section scrolls into view. Horizontal
              on desktop, vertical on mobile. Decorative, so it stays out of
              the accessibility tree. */}
          <span
            className="absolute top-7 right-0 left-0 hidden h-px bg-white/10 lg:block"
            aria-hidden
          >
            <span className="draw-x from-accent-600 to-accent-400 block h-px bg-gradient-to-r" />
          </span>
          <span
            className="absolute top-0 bottom-0 left-7 w-px bg-white/10 lg:hidden"
            aria-hidden
          >
            <span className="draw-y from-accent-600 to-accent-400 block h-full w-px bg-gradient-to-b" />
          </span>

          <Stagger as="ul" className="grid gap-10 lg:grid-cols-4 lg:gap-8">
            {STEPS.map(({ icon: Icon, step, title, detail }) => (
              <StaggerItem
                as="li"
                key={step}
                className="relative flex gap-5 lg:block"
              >
                <span className="bg-navy-800 relative z-10 grid size-14 shrink-0 place-items-center rounded-full ring-1 ring-white/12 ring-inset">
                  <Icon className="text-accent-400 size-5" aria-hidden />
                </span>

                <div className="lg:mt-7">
                  <p className="font-display text-accent-500 text-xs font-bold tracking-[0.18em]">
                    {step}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {title}
                  </h3>
                  <p className="text-silver-400 mt-2.5 text-sm leading-relaxed lg:pr-4">
                    {detail}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
