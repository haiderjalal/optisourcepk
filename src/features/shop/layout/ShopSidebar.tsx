"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Back-office navigation.
 *
 * A Client Component only because it highlights the active route; everything
 * it links to renders on the server.
 */

const NAV = [
  { href: "/shop", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/shop/orders", label: "Orders", icon: ClipboardList },
  { href: "/shop/invoices", label: "Invoices", icon: FileText },
  { href: "/shop/customers", label: "Customers", icon: Users },
  { href: "/shop/payments", label: "Payments", icon: Wallet },
  { href: "/shop/stock", label: "Stock", icon: Boxes },
  { href: "/shop/products", label: "Products", icon: Package },
] as const;

export function ShopSidebar({
  orientation = "vertical",
}: {
  /** "horizontal" is the scrolling strip shown above the content on mobile. */
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const horizontal = orientation === "horizontal";

  return (
    <nav aria-label="Back office" className="p-3">
      <ul className={cn(horizontal ? "flex gap-1" : "space-y-0.5")}>
        {NAV.map(({ href, label, icon: Icon, ...rest }) => {
          const exact = "exact" in rest && rest.exact;
          const active = exact ? pathname === href : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  horizontal && "whitespace-nowrap",
                  active
                    ? "bg-accent-600 text-white"
                    : "text-silver-400 hover:bg-navy-800 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
