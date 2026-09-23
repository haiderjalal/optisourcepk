import type { Metadata } from "next";
import { Plus, Truck } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listPurchases } from "@/services/shop/purchase.service";
import { PurchaseTable } from "@/features/shop/purchases/PurchaseTable";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Purchases" };

export default async function PurchasesPage() {
  await requireUser();
  const purchases = await listPurchases();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Purchasing</p>
          <h1 className="mt-2 text-2xl font-bold">Purchase invoices</h1>
          <p className="text-navy-500 mt-2 max-w-prose text-sm">
            Every delivery from a supplier. Saving a purchase takes its stock
            in.
          </p>
        </div>
        <ButtonLink href="/shop/purchases/new">
          <Plus className="size-4" aria-hidden />
          New purchase
        </ButtonLink>
      </div>

      {purchases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Truck className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">No purchases recorded yet.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            When a supplier&apos;s delivery arrives, enter their invoice here
            and the stock is received with it.
          </p>
          <ButtonLink href="/shop/purchases/new" className="mt-6">
            <Plus className="size-4" aria-hidden />
            Record the first purchase
          </ButtonLink>
        </div>
      ) : (
        <PurchaseTable purchases={purchases} />
      )}
    </div>
  );
}
