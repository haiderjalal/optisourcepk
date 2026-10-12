"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, Phone, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CONTACT, PRIMARY_NAV } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Mobile navigation sheet.
 *
 * The sheet remembers the pathname it was opened on, so a route change closes
 * it without an effect: a tapped link leaves the sheet behind on the old page
 * rather than hanging over the new one. Escape closes it and returns focus to
 * the trigger.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const isOpen = openedOn === pathname;

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenedOn(null);
      triggerRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label="Navigation menu"
        onClick={() => setOpenedOn(isOpen ? null : pathname)}
        className="text-navy-600 hover:bg-navy-50 grid size-10 place-items-center rounded-full transition-colors"
      >
        {isOpen ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Menu className="size-5" aria-hidden />
        )}
      </button>

      <div
        id={panelId}
        className={cn(
          "border-navy-100 shadow-lift-lg absolute top-12 right-0 w-[min(20rem,calc(100vw-2.5rem))] origin-top-right overflow-hidden rounded-2xl border bg-white p-3 transition-[opacity,transform,visibility] duration-200 ease-out",
          isOpen
            ? "visible scale-100 opacity-100"
            : "invisible scale-95 opacity-0",
        )}
      >
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
    </div>
  );
}
