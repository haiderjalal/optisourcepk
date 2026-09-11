import {
  ClipboardCheck,
  PackageCheck,
  ScanLine,
  Truck,
  type LucideIcon,
} from "lucide-react";
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

        <div className="relative mt-16">
          {/* Rail — draws itself once the section enters view. Horizontal on
              desktop, vertical on mobile. */}
          <Reveal
            direction="none"
            className="absolute top-7 right-0 left-0 hidden h-px bg-white/10 lg:block"
          >
            <span className="from-accent-600 to-accent-400 block h-px origin-left scale-x-0 bg-gradient-to-r transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] [[data-revealed]>&]:scale-x-100" />
          </Reveal>
          <Reveal
            direction="none"
            className="absolute top-0 bottom-0 left-7 w-px bg-white/10 lg:hidden"
          >
            <span className="from-accent-600 to-accent-400 block h-full w-px origin-top scale-y-0 bg-gradient-to-b transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] [[data-revealed]>&]:scale-y-100" />
          </Reveal>

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
