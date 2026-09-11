import type { Metadata } from "next";
import {
  Boxes,
  Gauge,
  Globe2,
  Microscope,
  PackageCheck,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stagger, StaggerItem } from "@/components/shared/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Capabilities",
  description:
    "How OptiSource PK sources, inspects, warehouses and dispatches optical supply — power verification, coating inspection, bin-location picking and private-label packaging.",
  alternates: { canonical: "/capabilities" },
  openGraph: {
    title: "Capabilities · OptiSource PK",
    description:
      "Sourcing, quality control, warehousing and private label for the Pakistani optical trade.",
    url: "/capabilities",
  },
};

const CAPABILITIES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Globe2,
    title: "Sourcing",
    body: "Direct relationships with lens and frame manufacturers, plus indent sourcing for lines we do not stock. If you can specify it, we can usually quote it.",
  },
  {
    icon: Microscope,
    title: "Incoming inspection",
    body: "Lens powers re-read on a focimeter by sample, coatings inspected under light box, frames checked for hinge action and finish before a carton is accepted into stock.",
  },
  {
    icon: Boxes,
    title: "Warehousing",
    body: "Bin-location storage with barcode picking. Fast-moving powers and sizes sit forward; slow lines sit back. Stock counts run on a rolling cycle, not once a year.",
  },
  {
    icon: PackageCheck,
    title: "Packing for the route",
    body: "Lenses in moulded trays, frames boxed, consumables sealed. Packed for a trunk route across Pakistan, not for a shelf twenty metres away.",
  },
  {
    icon: Tags,
    title: "Private label",
    body: "Cases, cloths, pouches and cleaning solution printed with your practice mark. Minimums start at 250 units for foil block and 500 for full colour.",
  },
  {
    icon: Gauge,
    title: "Forecast holding",
    body: "For partner accounts, we hold agreed stock against a rolling forecast so your reorders draw down from inventory we have already committed.",
  },
];

const QUALITY_CHECKS = [
  {
    stage: "On receipt",
    checks: [
      "Sample focimeter reading against declared power",
      "Coating adhesion and cosmetic inspection",
      "Carton count reconciled to packing list",
      "Batch and shelf-life recorded for chemistry lines",
    ],
  },
  {
    stage: "On pick",
    checks: [
      "Barcode scan against the docket line",
      "Power, addition and diameter re-read for Rx lenses",
      "Frame size and colour confirmed against order",
      "Second-person check on consignments over ten lines",
    ],
  },
  {
    stage: "On dispatch",
    checks: [
      "Packing list sealed inside the consignment",
      "Fragile lines tray-packed and void-filled",
      "Tracking reference issued to the account contact",
      "Discrepancy window of seven days from delivery",
    ],
  },
];

export default function CapabilitiesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Capabilities"
        title="What sits behind the delivery note."
        lede="A wholesaler is only as good as what happens between the manufacturer's carton and your bench. This is what happens in ours."
        crumbs={[{ label: "Capabilities" }]}
      />

      <section className="container-brand py-20 lg:py-24">
        <Stagger as="ul" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <StaggerItem as="li" key={title}>
              <div className="rounded-card border-navy-100 flex h-full flex-col border bg-white p-7">
                <span className="bg-navy-50 ring-navy-100 grid size-12 place-items-center rounded-2xl ring-1 ring-inset">
                  <Icon className="text-navy-600 size-5" aria-hidden />
                </span>
                <h2 className="mt-6 text-lg font-semibold">{title}</h2>
                <p className="text-navy-500 mt-2.5 text-sm leading-relaxed">
                  {body}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Quality */}
      <section
        id="quality"
        className="bg-navy-900 relative scroll-mt-24 overflow-hidden py-20 lg:py-24"
      >
        <div
          className="grid-blueprint absolute inset-0 opacity-20"
          aria-hidden
        />
        <div
          className="bg-accent-600/10 absolute top-0 right-0 h-96 w-96 rounded-full blur-[130px]"
          aria-hidden
        />

        <div className="container-brand relative">
          <SectionHeading
            inverted
            eyebrow="Quality standards"
            title="Three checkpoints, every consignment."
            lede="Nothing here is exotic. It is the ordinary discipline that stops a wrong lens reaching a patient — applied consistently rather than when someone remembers."
          />

          <Stagger as="ul" className="mt-14 grid gap-6 lg:grid-cols-3">
            {QUALITY_CHECKS.map((group, index) => (
              <StaggerItem as="li" key={group.stage}>
                <div className="rounded-card h-full border border-white/10 bg-white/4 p-7">
                  <p className="font-display text-accent-500 text-xs font-bold tracking-[0.18em]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-white">
                    {group.stage}
                  </h3>
                  <ul className="text-silver-400 mt-5 space-y-3 border-t border-white/10 pt-5 text-sm">
                    {group.checks.map((check) => (
                      <li key={check} className="flex gap-2.5">
                        <span
                          className="bg-accent-500 mt-2 size-1.5 shrink-0 rounded-full"
                          aria-hidden
                        />
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <p className="text-silver-500 mt-10 max-w-2xl text-xs leading-relaxed">
            Certificates of analysis, manufacturer data sheets and batch
            documentation are supplied on request for lens, coating and
            chemistry lines.
          </p>
        </div>
      </section>

      <section className="container-brand py-20 lg:py-24">
        <div className="rounded-card border-navy-100 flex flex-col gap-6 border bg-white p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-xl font-bold">
              Need something we have not listed?
            </h2>
            <p className="text-navy-500 mt-2 text-sm">
              Indent sourcing is a standing part of what we do. Send the
              specification and we will confirm whether we can land it, at what
              price, and by when.
            </p>
          </div>
          <ButtonLink href="/inquiry" size="lg" className="shrink-0">
            Send a specification
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
