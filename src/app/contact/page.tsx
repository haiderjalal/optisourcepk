import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stagger, StaggerItem } from "@/components/shared/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { CONTACT, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact OptiSource PK's trade desk in Lahore by phone, WhatsApp or email. Trade inquiries answered within one working day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact · OptiSource PK",
    description:
      "Reach the OptiSource PK trade desk by phone, WhatsApp or email.",
    url: "/contact",
  },
};

const CHANNELS = [
  {
    icon: Phone,
    label: "Call the trade desk",
    value: CONTACT.phone,
    href: CONTACT.phoneHref,
    detail: "Fastest for stock checks and lead times.",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: CONTACT.whatsapp,
    href: CONTACT.whatsappHref,
    detail: "Send a photo of a part or a prescription and we will identify it.",
    external: true,
  },
  {
    icon: Mail,
    label: "Email",
    value: CONTACT.email,
    href: CONTACT.emailHref,
    detail: "Best for quotations, tenders and account paperwork.",
  },
];

const FAQS = [
  {
    question: "Do you sell to the public?",
    answer:
      "No. OptiSource PK supplies the trade only — optical practices, retailers, glazing labs, hospitals and distributors. All accounts are trade accounts.",
  },
  {
    question: "Can I pay on the website?",
    answer:
      "No. This site does not take payment. You build a request list, we send a written quotation, and settlement is arranged directly once you approve it.",
  },
  {
    question: "Are the prices on the catalogue final?",
    answer:
      "They are indicative trade rates. Final pricing depends on volume, tier and current landed cost, and is confirmed on the quotation we send back.",
  },
  {
    question: "What is the minimum order?",
    answer:
      "Each line carries its own minimum order quantity, shown on the product. There is no overall minimum order value for an approved trade account.",
  },
  {
    question: "How quickly will I hear back?",
    answer:
      "Within one working day for inquiries received during trade desk hours. Stock checks by phone or WhatsApp are usually answered immediately.",
  },
  {
    question: "Can you supply something not in the catalogue?",
    answer:
      "Often, yes. Indent sourcing is a standing part of what we do — send the specification and we will confirm whether we can land it, at what price and by when.",
  },
];

export default function ContactPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PageHeader
        eyebrow="Contact"
        title="Talk to the trade desk."
        lede={`Stock checks, quotations, account paperwork or a part you cannot identify — reach us however suits. ${CONTACT.hours}.`}
        crumbs={[{ label: "Contact" }]}
      />

      {/* Channels */}
      <section className="container-brand py-16 lg:py-20">
        <Stagger as="ul" className="grid gap-5 lg:grid-cols-3">
          {CHANNELS.map(
            ({ icon: Icon, label, value, href, detail, external }) => (
              <StaggerItem as="li" key={label}>
                <a
                  href={href}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="group rounded-card border-navy-100 hover:border-accent-600/30 hover:shadow-lift flex h-full flex-col border bg-white p-7 transition-[border-color,box-shadow]"
                >
                  <span className="bg-navy-50 ring-navy-100 group-hover:bg-accent-600 group-hover:ring-accent-600 grid size-12 place-items-center rounded-2xl ring-1 transition-colors ring-inset">
                    <Icon
                      className="text-navy-600 size-5 transition-colors group-hover:text-white"
                      aria-hidden
                    />
                  </span>
                  <p className="eyebrow text-navy-400 mt-6 text-[0.625rem]">
                    {label}
                  </p>
                  <p className="font-display text-navy-700 mt-2 text-lg font-semibold">
                    {value}
                  </p>
                  <p className="text-navy-500 mt-3 text-sm leading-relaxed">
                    {detail}
                  </p>
                </a>
              </StaggerItem>
            ),
          )}
        </Stagger>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <div className="rounded-card border-navy-100 flex gap-4 border bg-white p-6">
            <MapPin className="text-accent-700 size-5 shrink-0" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold">Head office & warehouse</h2>
              <address className="text-navy-500 mt-2 text-sm leading-relaxed not-italic">
                {SITE.legalName}
                <br />
                {CONTACT.address.line1}
                <br />
                {CONTACT.address.city}, {CONTACT.address.country}
              </address>
            </div>
          </div>

          <div className="rounded-card border-navy-100 flex gap-4 border bg-white p-6">
            <Clock className="text-accent-700 size-5 shrink-0" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold">Trade desk hours</h2>
              <p className="text-navy-500 mt-2 text-sm leading-relaxed">
                {CONTACT.hours}
                <br />
                Closed Sundays and public holidays.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-navy-100 border-t bg-white py-20 lg:py-24">
        <div className="container-brand">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <SectionHeading
                eyebrow="Common questions"
                title="Before you write."
                lede="The six things we are asked most often, answered plainly."
              />
              <ButtonLink href="/inquiry" size="lg" className="mt-8">
                Start a Trade Inquiry
              </ButtonLink>
            </div>

            <dl className="divide-navy-100 border-navy-100 divide-y border-y">
              {FAQS.map((faq) => (
                <div key={faq.question} className="py-6">
                  <dt className="text-base font-semibold">{faq.question}</dt>
                  <dd className="text-navy-500 mt-2.5 text-sm leading-relaxed">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
