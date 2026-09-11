import { Boxes, FileCheck2, Handshake, Timer } from "lucide-react";
import { CountUp } from "@/components/shared/CountUp";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/Reveal";
import { SectionHeading } from "@/components/ui/section-heading";

const STATS: {
  value: number;
  suffix: string;
  label: string;
  decimals?: number;
}[] = [
  { value: 1800, suffix: "+", label: "SKUs held in Lahore" },
  { value: 48, suffix: " hrs", label: "Typical stock dispatch" },
  { value: 12, suffix: " mo", label: "Coating warranty" },
  { value: 99.2, suffix: "%", label: "Order-accuracy rate", decimals: 1 },
];

const REASONS = [
  {
    icon: Boxes,
    title: "Depth, not breadth theatre",
    body: "We hold the powers, sizes and colours that actually move. A catalogue is only useful if the line is on the shelf when you ring.",
  },
  {
    icon: FileCheck2,
    title: "Verified before it ships",
    body: "Lens powers are re-read and coatings inspected against the docket. The cost of a wrong lens is never the lens — it is the patient waiting.",
  },
  {
    icon: Timer,
    title: "Lead times you can quote against",
    body: "Ex-stock and indent lines are marked separately, so you can promise a patient a date without hedging.",
  },
  {
    icon: Handshake,
    title: "Terms that respect cash flow",
    body: "Net 30 on approved trade accounts, consolidated monthly invoicing, and one point of contact who knows your account.",
  },
];

export function WhySection() {
  return (
    <section className="container-brand py-20 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <SectionHeading
            eyebrow="Why OptiSource"
            title="Better optics, brighter businesses."
            lede="We supply the trade only — practices, glazing labs, hospitals and optical retailers. That focus is what lets us hold stock deep and quote fast."
          />

          <Stagger className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8">
            {STATS.map((stat) => (
              <StaggerItem key={stat.label}>
                <p className="font-display text-navy-700 text-4xl font-bold tabular-nums lg:text-5xl">
                  <CountUp value={stat.value} decimals={stat.decimals ?? 0} />
                  <span className="text-accent-600">{stat.suffix}</span>
                </p>
                <p className="text-navy-500 mt-2 text-sm">{stat.label}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Stagger as="ul" className="grid gap-4 sm:grid-cols-2 lg:mt-4">
          {REASONS.map(({ icon: Icon, title, body }) => (
            <StaggerItem as="li" key={title}>
              <div className="rounded-card border-navy-100 shadow-lift flex h-full flex-col border bg-white p-6">
                <span className="bg-accent-600/10 ring-accent-600/15 grid size-11 place-items-center rounded-xl ring-1 ring-inset">
                  <Icon className="text-accent-700 size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-base font-semibold">{title}</h3>
                <p className="text-navy-500 mt-2 text-sm leading-relaxed">
                  {body}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <Reveal className="mt-16">
        <div className="rounded-card bg-navy-700 relative overflow-hidden p-8 text-white sm:p-12">
          <div
            className="grid-blueprint absolute inset-0 opacity-20"
            aria-hidden
          />
          <div
            className="bg-accent-600/20 absolute -right-24 -bottom-32 size-96 rounded-full blur-[110px]"
            aria-hidden
          />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="brand-rule" />
              <p className="font-display mt-6 text-2xl leading-[1.15] font-bold sm:text-3xl lg:text-[2.25rem]">
                One partner. One delivery note.
                <br />
                <span className="text-silver-300">
                  One invoice at month end.
                </span>
              </p>
              <p className="text-silver-400 mt-5 max-w-xl text-sm leading-relaxed">
                Consolidating supply is the quietest margin gain available to a
                practice: fewer deliveries to receive, fewer invoices to
                reconcile, and one number to ring when something is wrong.
              </p>
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-x-10 gap-y-6 lg:grid-cols-1 lg:gap-y-5">
              <div>
                <dt className="eyebrow text-accent-400 text-[0.625rem]">
                  Payment terms
                </dt>
                <dd className="font-display mt-1.5 text-lg font-semibold">
                  Net 30 on approval
                </dd>
              </div>
              <div>
                <dt className="eyebrow text-accent-400 text-[0.625rem]">
                  Coverage
                </dt>
                <dd className="font-display mt-1.5 text-lg font-semibold">
                  Nationwide dispatch
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
