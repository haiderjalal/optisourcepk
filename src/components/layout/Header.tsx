import Link from "next/link";
import { ArrowRight, FileText, Menu, Phone } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { ButtonLink } from "@/components/ui/button";
import { CONTACT, PRIMARY_NAV, SITE } from "@/lib/site";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/92 backdrop-blur-xl">
      {/* Trade strip — the tagline line that sits above every brand lockup */}
      <div className="bg-navy-900 text-silver-300 hidden h-9 md:block">
        <div className="container-brand flex h-9 items-center justify-between">
          <p className="eyebrow text-silver-400 text-[0.625rem]">
            {SITE.tagline}
          </p>
          <div className="flex items-center gap-5 text-xs">
            <a
              href={CONTACT.phoneHref}
              className="flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Phone className="size-3.5" aria-hidden />
              {CONTACT.phone}
            </a>
            <span className="text-navy-500" aria-hidden>
              |
            </span>
            <span className="text-silver-400">B2B Trade Supply Only</span>
          </div>
        </div>
      </div>

      <div className="border-navy-100 border-b shadow-[0_1px_24px_-8px_rgb(16_32_58/0.18)]">
        <div className="container-brand flex h-16 items-center justify-between gap-3 lg:h-[4.5rem] xl:gap-6">
          <Link
            href="/"
            className="shrink-0"
            aria-label={`${SITE.name} — home`}
          >
            <Logo />
          </Link>

          <nav
            className="hidden items-center lg:flex xl:gap-1"
            aria-label="Primary"
          >
            {PRIMARY_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-navy-500 hover:text-navy-700 rounded-full px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors xl:px-3.5"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/inquiry"
              className="text-navy-600 hover:bg-navy-50 relative flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors"
            >
              <FileText className="size-[1.05rem]" aria-hidden />
              <span className="hidden xl:inline">Request list</span>
              <span className="sr-only">Request list</span>
            </Link>

            <ButtonLink
              href="/inquiry"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Trade Inquiry
              <ArrowRight
                className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                aria-hidden
              />
            </ButtonLink>

            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileMenu() {
  return (
    <details className="group relative lg:hidden">
      <summary
        className="text-navy-600 hover:bg-navy-50 grid size-10 cursor-pointer list-none place-items-center rounded-full transition-colors [&::-webkit-details-marker]:hidden"
        aria-label="Toggle navigation menu"
      >
        <Menu className="size-5" aria-hidden />
      </summary>

      <div className="border-navy-100 shadow-lift-lg absolute top-12 right-0 w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border bg-white p-3">
        <nav className="flex flex-col" aria-label="Mobile">
          {PRIMARY_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-navy-700 hover:bg-navy-50 rounded-xl px-4 py-3 text-base font-semibold transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="border-navy-100 mt-2 space-y-2 border-t pt-3">
          <ButtonLink href="/inquiry" className="w-full">
            Start a Trade Inquiry
            <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
          <a
            href={CONTACT.phoneHref}
            className="text-navy-500 hover:text-navy-700 flex items-center justify-center gap-2 rounded-xl py-2 text-sm transition-colors"
          >
            <Phone className="size-4" aria-hidden />
            {CONTACT.phone}
          </a>
        </div>
      </div>
    </details>
  );
}
