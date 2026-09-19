import type { Metadata } from "next";
import { requireUser } from "@/server/shop/dal";

export const metadata: Metadata = { title: "Dashboard" };

export default async function ShopDashboardPage() {
  // Re-checked here rather than trusted from the layout: a layout's guard does
  // not run for a Server Function invoked from this route.
  await requireUser();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow text-accent-600">Back office</p>
      <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
      <p className="text-navy-500 mt-3 max-w-prose leading-relaxed">
        Orders, invoicing, stock and customer ledgers. The sections are being
        built out in order — customers and stock first, then invoicing.
      </p>
    </div>
  );
}
