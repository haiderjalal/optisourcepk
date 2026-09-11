import type { Metadata } from "next";
import { Clock, Mail, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InquiryForm } from "@/features/inquiry/InquiryForm";
import { RequestList } from "@/features/inquiry/RequestList";
import { CONTACT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Trade Inquiry",
  description:
    "Request a written quotation from OptiSource PK. Build a request list from the catalogue, tell us about your practice or lab, and we will respond within one working day.",
  alternates: { canonical: "/inquiry" },
  robots: { index: true, follow: true },
};

const STEPS = [
  {
    title: "You send the list",
    body: "Catalogue lines, a description in the notes, or both. Nothing is committed.",
  },
  {
    title: "We quote in writing",
    body: "Confirmed pricing, availability and lead times — usually within one working day.",
  },
  {
    title: "You approve, we dispatch",
    body: "Approve the quotation and the consignment is picked, packed and on its way.",
  },
];

export default function InquiryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trade Inquiry"
        title="Tell us what you need."
        lede="No payment is taken here. Send us a request and a member of the trade desk will come back with a written quotation, indicative lead times and terms."
        crumbs={[{ label: "Trade Inquiry" }]}
      />

      <div className="container-brand py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
          <div className="order-2 lg:order-1">
            <InquiryForm />
          </div>

          <aside className="order-1 space-y-6 lg:order-2">
            <RequestList />

            <div className="rounded-card border-navy-100 border bg-white p-6">
              <h2 className="eyebrow text-navy-400">What happens next</h2>
              <ol className="mt-5 space-y-5">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="bg-accent-600/10 font-display text-accent-700 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="text-navy-500 mt-1 text-sm leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-card bg-navy-700 p-6 text-white">
              <h2 className="eyebrow text-accent-400">Prefer to talk?</h2>
              <ul className="mt-5 space-y-3.5 text-sm">
                <li>
                  <a
                    href={CONTACT.phoneHref}
                    className="hover:text-accent-400 flex items-center gap-3 transition-colors"
                  >
                    <Phone className="text-accent-500 size-4" aria-hidden />
                    {CONTACT.phone}
                  </a>
                </li>
                <li>
                  <a
                    href={CONTACT.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-400 flex items-center gap-3 transition-colors"
                  >
                    <MessageCircle
                      className="text-accent-500 size-4"
                      aria-hidden
                    />
                    WhatsApp {CONTACT.whatsapp}
                  </a>
                </li>
                <li>
                  <a
                    href={CONTACT.emailHref}
                    className="hover:text-accent-400 flex items-center gap-3 transition-colors"
                  >
                    <Mail className="text-accent-500 size-4" aria-hidden />
                    {CONTACT.email}
                  </a>
                </li>
                <li className="text-silver-400 flex items-center gap-3">
                  <Clock className="text-accent-500 size-4" aria-hidden />
                  {CONTACT.hours}
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
