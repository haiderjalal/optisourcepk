import type { Metadata } from "next";
import {
  Building2,
  FlaskConical,
  Hospital,
  Store,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Bulk Supply & Trade Accounts",
  description:
    "Open a trade account with OptiSource PK. Volume pricing, Net 30 terms, standing orders and nationwide dispatch for optical practices, retailers, glazing labs and hospitals across Pakistan.",
  alternates: { canonical: "/bulk-supply" },
  openGraph: {
    title: "Bulk Supply & Trade Accounts · OptiSource PK",
    description:
      "Volume pricing, Net 30 terms and standing orders for the Pakistani optical trade.",
    url: "/bulk-supply",
  },
};

const SEGMENTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Store,
    title: "Optical practices",
    body: "Weekly stock lenses, frame boards refreshed by assortment, and the counter lines that carry the margin.",
  },
  {
    icon: FlaskConical,
    title: "Glazing & surfacing labs",
    body: "Standing orders on blocking pads, wheels, polish, tints and neutralisers so the line never stops mid-shift.",
  },
  {
    icon: Building2,
    title: "Optical retail chains",
    body: "Multi-branch delivery against one account, with consolidated monthly invoicing and per-branch delivery notes.",
  },
  {
    icon: Hospital,
    title: "Hospitals & clinics",
    body: "Exam-room equipment, trial sets, charts and vision-care consumables supplied against tender or standing requisition.",
  },
];

const TIERS = [
  {
    name: "Trade",
    qualifier: "From your first order",
    price: "Standard trade rates",
    features: [
      "Full catalogue access",
      "Written quotation on every request",
      "Ex-stock dispatch within 48 hours",
      "Payment in advance or on delivery",
    ],
  },
  {
    name: "Trade Plus",
    qualifier: "Regular monthly volume",
    price: "Volume tier pricing",
    features: [
      "Tiered pricing above break quantities",
      "Net 30 terms on approval",
      "Named account contact",
      "Standing orders on consumables",
      "Priority on indent lines",
    ],
    highlighted: true,
  },
  {
    name: "Partner",
    qualifier: "Chains, labs and distributors",
    price: "Negotiated agreement",
    features: [
      "Contract pricing reviewed quarterly",
      "Multi-branch delivery scheduling",
      "Consolidated monthly invoicing",
      "Private-label cases, cloths and pouches",
      "Stock holding against forecast",
    ],
  },
];

const LOGISTICS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Warehouse,
    title: "Held, not ordered in",
    body: "Fast-moving lines sit in Islamabad under bin location. If a line is marked ex-stock, it is on the shelf when you ring — not on a purchase order.",
  },
  {
    icon: Truck,
    title: "Nationwide dispatch",
    body: "Same-day dispatch on stock lines booked before 15:00, with a tracking reference sent to WhatsApp. Karachi, Islamabad, Faisalabad, Peshawar and onward.",
  },
];

export default function BulkSupplyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Bulk Supply"
        title="Terms built around how practices actually buy."
        lede="Optical supply is a cash-flow business. We price in volume tiers, hold the fast lines in depth, and settle on terms that do not force you to fund our stock."
        crumbs={[{ label: "Bulk Supply" }]}
      >
        <ButtonLink href="/inquiry" size="lg">
          Open a trade account
        </ButtonLink>
      </PageHeader>

      {/* Who we supply */}
      <section className="container-brand py-20 lg:py-24">
        <SectionHeading
          eyebrow="Who we supply"
          title="Trade only — no retail counter."
          lede="We do not sell to the public, and we do not compete with our customers. That is the whole basis of the relationship."
        />

        <Stagger as="ul" className="mt-12 grid gap-5 sm:grid-cols-2">
          {SEGMENTS.map(({ icon: Icon, title, body }) => (
            <StaggerItem as="li" key={title}>
              <div className="rounded-card border-navy-100 flex h-full gap-5 border bg-white p-6">
                <span className="bg-navy-50 ring-navy-100 grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset">
                  <Icon className="text-navy-600 size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="text-navy-500 mt-2 text-sm leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Account tiers */}
      <section className="border-navy-100 border-y bg-white py-20 lg:py-24">
        <div className="container-brand">
          <SectionHeading
            align="center"
            eyebrow="Account tiers"
            title="Three ways to buy."
            lede="Tiers move with volume, not with negotiation stamina. Tell us your monthly run rate and we will place you honestly."
          />

          <Stagger as="ul" className="mt-14 grid gap-5 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <StaggerItem as="li" key={tier.name}>
                <div
                  className={
                    tier.highlighted
                      ? "rounded-card bg-navy-700 relative flex h-full flex-col overflow-hidden p-7 text-white"
                      : "rounded-card border-navy-100 flex h-full flex-col border bg-mist-50 p-7"
                  }
                >
                  {tier.highlighted && (
                    <>
                      <div
                        className="grid-blueprint absolute inset-0 opacity-20"
                        aria-hidden
                      />
                      <span className="bg-accent-600 relative mb-4 self-start rounded-full px-3 py-1 text-[0.625rem] font-bold tracking-[0.12em] uppercase">
                        Most common
                      </span>
                    </>
                  )}

                  <div className="relative">
                    <h3
                      className={
                        tier.highlighted
                          ? "font-display text-xl font-bold text-white"
                          : "font-display text-xl font-bold"
                      }
                    >
                      {tier.name}
                    </h3>
                    <p
                      className={
                        tier.highlighted
                          ? "text-silver-400 mt-1 text-xs"
                          : "text-navy-400 mt-1 text-xs"
                      }
                    >
                      {tier.qualifier}
                    </p>
                    <p
                      className={
                        tier.highlighted
                          ? "font-display text-accent-400 mt-5 text-lg font-semibold"
                          : "font-display text-accent-700 mt-5 text-lg font-semibold"
                      }
                    >
                      {tier.price}
                    </p>

                    <ul
                      className={
                        tier.highlighted
                          ? "text-silver-300 mt-6 space-y-3 border-t border-white/10 pt-6 text-sm"
                          : "border-navy-100 text-navy-600 mt-6 space-y-3 border-t pt-6 text-sm"
                      }
                    >
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex gap-2.5">
                          <span
                            className="bg-accent-600 mt-2 size-1.5 shrink-0 rounded-full"
                            aria-hidden
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <p className="text-navy-400 mt-8 text-center text-xs">
            Terms are offered subject to account approval and trading history.
            Nothing on this page is a binding offer.
          </p>
        </div>
      </section>

      {/* Logistics */}
      <section className="container-brand py-20 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <SectionHeading
            eyebrow="Logistics"
            title="Stock you can promise a patient."
            lede="Every listed line is marked ex-stock or indent. That single distinction is what lets you give a patient a date instead of a hope."
          />

          <Stagger className="space-y-5">
            {LOGISTICS.map(({ icon: Icon, title, body }) => (
              <StaggerItem key={title}>
                <div className="rounded-card border-navy-100 flex gap-5 border bg-white p-6">
                  <span className="bg-accent-600/10 grid size-11 shrink-0 place-items-center rounded-xl">
                    <Icon className="text-accent-700 size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{title}</h3>
                    <p className="text-navy-500 mt-2 text-sm leading-relaxed">
                      {body}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal className="mt-14">
          <div className="rounded-card border-navy-100 flex flex-col gap-6 border bg-white p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Ready to open an account?</h2>
              <p className="text-navy-500 mt-2 text-sm">
                Send us your typical monthly requirement. We will confirm the
                tier, the pricing and the terms in writing.
              </p>
            </div>
            <ButtonLink href="/inquiry" size="lg" className="shrink-0">
              Start a Trade Inquiry
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}
