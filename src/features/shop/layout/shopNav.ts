import {
  Boxes,
  Building2,
  ClipboardList,
  FileText,
  Glasses,
  LayoutDashboard,
  Package,
  Receipt,
  Trash2,
  Truck,
  Undo2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Back-office navigation, defined once.
 *
 * The desktop sidebar and the phone tab bar both read from here, so a new
 * screen is added in one place and cannot be missing from one of them.
 */

export interface ShopNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match the path exactly rather than as a prefix (the dashboard only). */
  exact?: boolean;
}

export interface ShopNavGroup {
  label: string;
  items: ShopNavItem[];
}

export const SHOP_NAV: ShopNavGroup[] = [
  {
    label: "Sell",
    items: [
      { href: "/shop", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/shop/orders", label: "Orders", icon: ClipboardList },
      { href: "/shop/rx", label: "RX orders", icon: Glasses },
      { href: "/shop/invoices", label: "Invoices", icon: FileText },
      { href: "/shop/returns", label: "Returns", icon: Undo2 },
    ],
  },
  {
    label: "Accounts",
    items: [
      { href: "/shop/customers", label: "Customers", icon: Users },
      { href: "/shop/payments", label: "Payments", icon: Wallet },
      { href: "/shop/expenses", label: "Expenses", icon: Receipt },
    ],
  },
  {
    label: "Stock",
    items: [
      { href: "/shop/stock", label: "Stock", icon: Boxes },
      { href: "/shop/products", label: "Products", icon: Package },
      { href: "/shop/purchases", label: "Purchases", icon: Truck },
      { href: "/shop/suppliers", label: "Suppliers", icon: Building2 },
    ],
  },
  {
    label: "System",
    items: [{ href: "/shop/trash", label: "Recently deleted", icon: Trash2 }],
  },
];

/** The five destinations a phone user reaches for; the rest sit under More. */
export const SHOP_TABS: ShopNavItem[] = [
  { href: "/shop", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/shop/orders", label: "Orders", icon: ClipboardList },
  { href: "/shop/customers", label: "Shops", icon: Users },
  { href: "/shop/payments", label: "Payments", icon: Wallet },
];

export function isActiveShopPath(pathname: string, item: ShopNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
