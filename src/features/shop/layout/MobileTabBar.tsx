"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SHOP_NAV,
  SHOP_TABS,
  isActiveShopPath,
  type ShopNavItem,
} from "./shopNav";

/**
 * Phone navigation: the five places a shop is worked from, thumb-reachable at
 * the foot of the screen. Everything else sits behind More, so no page is more
 * than two taps away on a phone.
 *
 * `account` is server-rendered (the sign-out form), passed in as a node.
 */
export function MobileTabBar({ account }: { account: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-mist-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {SHOP_TABS.map((tab) => (
            <TabLink
              key={tab.href}
              item={tab}
              active={isActiveShopPath(pathname, tab)}
            />
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className="text-navy-500 flex w-full flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium"
            >
              <span className="grid h-7 w-14 place-items-center rounded-full">
                <EllipsisVertical className="size-5" aria-hidden />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="bg-navy-900/50 absolute inset-0"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="All pages"
            className="shadow-lift-lg absolute inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto rounded-t-3xl bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-mist-300" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold">All pages</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-navy-500 rounded-full p-2 hover:bg-mist-100"
              >
                <X className="size-5" aria-hidden />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <div className="space-y-5">
              {SHOP_NAV.map((group) => (
                <section key={group.label}>
                  <h2 className="eyebrow text-navy-400 mb-2">{group.label}</h2>
                  <ul className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const active = isActiveShopPath(pathname, item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-medium",
                              active
                                ? "bg-accent-600 text-white"
                                : "text-navy-700 bg-mist-50 ring-1 ring-mist-200 ring-inset",
                            )}
                          >
                            <item.icon
                              className="size-4 shrink-0"
                              aria-hidden
                            />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>

            <div className="mt-6 border-t border-mist-200 pt-4">{account}</div>
          </div>
        </div>
      )}
    </>
  );
}

function TabLink({ item, active }: { item: ShopNavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium transition-colors",
          active ? "text-accent-700" : "text-navy-500",
        )}
      >
        <span
          className={cn(
            "grid h-7 w-14 place-items-center rounded-full transition-colors",
            active && "bg-accent-600/10",
          )}
        >
          <item.icon className="size-5" aria-hidden />
        </span>
        {item.label}
      </Link>
    </li>
  );
}
