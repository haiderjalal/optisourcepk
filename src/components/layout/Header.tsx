"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { ArrowRight, Menu, Phone, FileText, X } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { ButtonLink } from "@/components/ui/button";
import { useQuote } from "@/features/inquiry/useQuote";
import { CONTACT, PRIMARY_NAV, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const { count, hydrated } = useQuote();
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);

  // The sheet remembers which route it was opened on, so a navigation closes
  // it during render — no effect, and no flash of an open menu on the new page.
  const [menu, setMenu] = useState({ open: false, route: pathname });
  const menuOpen = menu.open && menu.route === pathname;

  const openMenu = () => setMenu({ open: true, route: pathname });
  const closeMenu = () => setMenu({ open: false, route: pathname });

  useMotionValueEvent(scrollY, "change", (value) => {
    setCondensed(value > 24);
  });

  // Lock the page behind the sheet.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50">
      {/* Trade strip — the tagline line that sits above every brand lockup */}
      <div
        className={cn(
          "bg-navy-900 text-silver-300 hidden transition-[height,opacity] duration-300 md:block",
          condensed ? "h-0 overflow-hidden opacity-0" : "h-9 opacity-100",
        )}
      >
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

      <div
        className={cn(
          "border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300",
          condensed
            ? "border-navy-100 bg-white/88 shadow-[0_1px_24px_-8px_rgb(16_32_58/0.24)]"
            : "border-transparent bg-white/72",
        )}
      >
        <div className="container-brand flex h-16 items-center justify-between gap-3 lg:h-[4.5rem] xl:gap-6">
          <Link
            href="/"
            className="shrink-0"
            aria-label={`${SITE.name} — home`}
          >
            <Logo id="header" />
          </Link>

          <nav
            className="hidden items-center lg:flex xl:gap-1"
            aria-label="Primary"
          >
            {PRIMARY_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors xl:px-3.5",
                  isActive(link.href)
                    ? "text-navy-700"
                    : "text-navy-500 hover:text-navy-700",
                )}
              >
                {link.label}
                {isActive(link.href) && (
                  <motion.span
                    layoutId="nav-active"
                    className="bg-accent-600 absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full xl:inset-x-3.5"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
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
              <span className="sr-only">
                {hydrated
                  ? `${count} items in your request list`
                  : "Request list"}
              </span>
              {hydrated && count > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-accent-600 absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full text-[0.625rem] font-bold text-white"
                  aria-hidden
                >
                  {count}
                </motion.span>
              )}
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

            <button
              type="button"
              onClick={openMenu}
              className="text-navy-600 hover:bg-navy-50 grid size-10 place-items-center rounded-full transition-colors lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && <MobileMenu onClose={closeMenu} />}
      </AnimatePresence>
    </header>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="bg-navy-900 fixed inset-0 z-50 lg:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="grid-blueprint absolute inset-0 opacity-30" aria-hidden />

      <div className="relative flex h-full flex-col">
        <div className="container-brand flex h-16 items-center justify-between">
          <Logo inverted compact id="menu" />
          <button
            type="button"
            onClick={onClose}
            className="text-silver-200 grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav
          className="container-brand flex flex-1 flex-col justify-center gap-1"
          aria-label="Mobile"
        >
          {PRIMARY_NAV.map((link, index) => (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * index + 0.06, duration: 0.4 }}
            >
              <Link
                href={link.href}
                className="font-display block border-b border-white/8 py-4 text-2xl font-semibold text-white"
              >
                {link.label}
              </Link>
            </motion.div>
          ))}
        </nav>

        <div className="container-brand space-y-3 pb-10">
          <ButtonLink href="/inquiry" size="lg" className="w-full">
            Start a Trade Inquiry
            <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
          <a
            href={CONTACT.phoneHref}
            className="text-silver-300 flex items-center justify-center gap-2 py-2 text-sm"
          >
            <Phone className="size-4" aria-hidden />
            {CONTACT.phone}
          </a>
        </div>
      </div>
    </motion.div>
  );
}
