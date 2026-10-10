"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SHOP_NAV, isActiveShopPath } from "./shopNav";

/**
 * Desktop back-office navigation, grouped by the work it supports.
 *
 * A Client Component only because it highlights the active route; everything
 * it links to renders on the server.
 */
export function ShopSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Back office" className="space-y-5 px-3 py-4">
      {SHOP_NAV.map((group) => (
        <div key={group.label}>
          <p className="text-silver-500 px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.18em] uppercase">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActiveShopPath(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgb(37_99_235/0.9)]"
                        : "text-silver-400 hover:bg-navy-800 hover:text-white",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
