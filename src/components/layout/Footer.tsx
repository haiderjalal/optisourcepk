import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { ButtonLink } from "@/components/ui/button";
import { CONTACT, FOOTER_NAV, SITE } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-900 text-silver-300 relative overflow-hidden">
      <div className="grid-blueprint absolute inset-0 opacity-25" aria-hidden />
      <div
        className="bg-accent-600/10 absolute -top-40 left-1/4 h-96 w-96 rounded-full blur-[130px]"
        aria-hidden
      />

      <div className="relative">
        {/* Closing call to action */}
        <div className="container-brand border-b border-white/8 py-16 lg:py-20">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <span className="brand-rule" />
              <h2 className="mt-6 text-3xl leading-[1.1] font-bold text-white sm:text-4xl lg:text-[2.75rem]">
                Clearer tomorrow,
                <br />
                together.
              </h2>
              <p className="text-silver-400 mt-5 text-base leading-relaxed">
                Tell us what you dispense and how often. We will come back with
                a written quotation, indicative lead times and a supply plan
                built around your turnover.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/inquiry" variant="inverted" size="lg">
                Start a Trade Inquiry
                <ArrowUpRight
                  className="size-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5"
                  aria-hidden
                />
              </ButtonLink>
              <ButtonLink
                href={CONTACT.whatsappHref}
                variant="outlineInverted"
                size="lg"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </ButtonLink>
            </div>
          </div>
        </div>

        {/* Directory */}
        <div className="container-brand grid gap-12 py-14 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:py-16">
          <div>
            <Logo inverted />
            <p className="text-silver-400 mt-6 max-w-xs text-sm leading-relaxed">
              {SITE.description}
            </p>
            <ul className="mt-7 space-y-3 text-sm">
              <li>
                <a
                  href={CONTACT.phoneHref}
                  className="flex items-center gap-3 transition-colors hover:text-white"
                >
                  <Phone
                    className="text-accent-500 size-4 shrink-0"
                    aria-hidden
                  />
                  {CONTACT.phone}
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.emailHref}
                  className="flex items-center gap-3 transition-colors hover:text-white"
                >
                  <Mail
                    className="text-accent-500 size-4 shrink-0"
                    aria-hidden
                  />
                  {CONTACT.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin
                  className="text-accent-500 mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <span>
                  {CONTACT.address.line1}
                  <br />
                  {CONTACT.address.city}, {CONTACT.address.country}
                </span>
              </li>
            </ul>
          </div>

          {FOOTER_NAV.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="eyebrow text-silver-500 text-[0.625rem]">
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3 text-sm">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-silver-300 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="container-brand text-silver-500 flex flex-col gap-4 border-t border-white/8 py-7 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE.legalName}. All rights reserved.
          </p>
          <p className="eyebrow text-silver-500 text-[0.625rem]">
            {SITE.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
