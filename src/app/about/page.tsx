import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { LogoMark } from "@/components/shared/Logo";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { CONTACT, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "OptiSource PK is a wholesale optical supplier based in Lahore, supplying lenses, frames, accessories, lab consumables and optometric equipment to the Pakistani optical trade.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About · OptiSource PK",
    description:
      "A wholesale optical supplier built around the way Pakistani practices and labs actually buy.",
    url: "/about",
  },
};

/** The four-word value sets printed across the brand book signage. */
const VALUES = [
  {
    word: "Focus",
    body: "We supply the optical trade and nothing else. No retail counter, no side business, no competing with the practices we serve.",
  },
  {
    word: "Support",
    body: "One named contact who knows your account, your run rate and what you dispensed last month — not a queue and a ticket number.",
  },
  {
    word: "People",
    body: "Behind every order is a patient waiting for spectacles. That is the clock we work against, and it is why a wrong lens is never a small problem.",
  },
  {
    word: "Progress",
    body: "Better stock discipline, tighter lead times, clearer documentation. We would rather improve the boring parts than announce new ones.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Your partner in clear vision."
        lede="OptiSource PK supplies the optical trade across Pakistan — lenses, frames, accessories, lab consumables and exam-room equipment, held in depth and shipped from Lahore."
        crumbs={[{ label: "About" }]}
      />

      {/* Position */}
      <section className="container-brand py-20 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <Reveal>
            <div className="rounded-card bg-navy-800 relative overflow-hidden p-10">
              <div
                className="grid-blueprint absolute inset-0 opacity-25"
                aria-hidden
              />
              <div
                className="bg-accent-600/20 absolute -right-20 -bottom-24 size-80 rounded-full blur-[100px]"
                aria-hidden
              />
              <div className="relative flex flex-col items-start">
                <LogoMark tone="inverted" className="w-28" />
                <p className="font-display mt-8 text-2xl leading-tight font-bold text-white">
                  Better optics,
                  <br />
                  brighter businesses.
                </p>
                <span className="brand-rule mt-6" />
                <p className="eyebrow text-silver-400 mt-6 text-[0.625rem]">
                  {SITE.tagline}
                </p>
              </div>
            </div>
          </Reveal>

          <div>
            <SectionHeading
              eyebrow="Why we exist"
              title="Optical supply in Pakistan is fragmented."
            />
            <div className="text-navy-600 mt-8 space-y-5 leading-relaxed">
              <p>
                Most practices buy lenses from one supplier, frames from
                another, consumables from a third and exam-room equipment from
                whoever answers the phone. Four relationships, four delivery
                schedules, four invoices, and four different answers when
                something goes wrong.
              </p>
              <p>
                OptiSource PK exists to collapse that into one. We hold the
                ranges an optical business actually restocks, we mark clearly
                what is on the shelf and what has to be indented, and we quote
                in writing so nobody is working from a remembered price.
              </p>
              <p>
                We are a trade supplier only. We do not run a retail counter and
                we do not sell to the public — so nothing we do competes with
                the businesses we supply. That is deliberate, and it is not
                negotiable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-navy-100 border-y bg-white py-20 lg:py-24">
        <div className="container-brand">
          <SectionHeading
            align="center"
            eyebrow="What we hold to"
            title="Focus. Support. People. Progress."
            lede="Four words on the wall of our warehouse. They are useful only insofar as they describe what actually happens, so here is what each one means in practice."
          />

          <Stagger as="ul" className="mt-14 grid gap-5 sm:grid-cols-2">
            {VALUES.map((value) => (
              <StaggerItem as="li" key={value.word}>
                <div className="rounded-card border-navy-100 flex h-full flex-col border bg-mist-50 p-7">
                  <h3 className="font-display text-navy-700 text-2xl font-bold">
                    {value.word}
                  </h3>
                  <span className="brand-rule mt-4" />
                  <p className="text-navy-500 mt-5 text-sm leading-relaxed">
                    {value.body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Practicalities */}
      <section className="container-brand py-20 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <SectionHeading
            eyebrow="Where we are"
            title="Lahore, shipping nationwide."
            lede="Our warehouse and trade desk sit together, which is why the person who answers the phone can tell you whether a line is physically on the shelf."
          />

          <dl className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            <div>
              <dt className="eyebrow text-navy-400 text-[0.625rem]">
                Head office & warehouse
              </dt>
              <dd className="text-navy-600 mt-2 text-sm leading-relaxed">
                {CONTACT.address.line1}
                <br />
                {CONTACT.address.city}, {CONTACT.address.country}
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-navy-400 text-[0.625rem]">
                Trade desk hours
              </dt>
              <dd className="text-navy-600 mt-2 text-sm leading-relaxed">
                {CONTACT.hours}
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-navy-400 text-[0.625rem]">
                Who we supply
              </dt>
              <dd className="text-navy-600 mt-2 text-sm leading-relaxed">
                Optical practices, retailers, glazing and surfacing labs,
                hospitals, clinics and distributors.
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-navy-400 text-[0.625rem]">
                Who we do not
              </dt>
              <dd className="text-navy-600 mt-2 text-sm leading-relaxed">
                Members of the public. All accounts are trade accounts.
              </dd>
            </div>
          </dl>
        </div>

        <Reveal className="mt-14">
          <div className="rounded-card bg-navy-700 flex flex-col gap-6 p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold">
                Clearer tomorrow, together.
              </h2>
              <p className="text-silver-400 mt-3 text-sm leading-relaxed">
                Tell us what your practice or lab goes through in a month. We
                will tell you honestly whether we can improve on what you are
                paying and waiting today.
              </p>
            </div>
            <ButtonLink
              href="/inquiry"
              variant="inverted"
              size="lg"
              className="shrink-0"
            >
              Start a Trade Inquiry
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}
