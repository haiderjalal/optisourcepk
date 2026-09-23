import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listSuppliers } from "@/services/shop/supplier.service";
import { listSellableProducts } from "@/services/shop/product.service";
import { PurchaseForm } from "@/features/shop/purchases/PurchaseForm";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "New purchase" };

export default async function NewPurchasePage() {
  await requireUser();

  const [suppliers, products] = await Promise.all([
    listSuppliers(),
    listSellableProducts(),
  ]);

  const blocked = suppliers.length === 0 || products.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/shop/purchases"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Purchases
      </Link>

      <h1 className="mb-6 text-2xl font-bold">New purchase</h1>

      {blocked ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-12 text-center">
          <h2 className="font-semibold">
            {suppliers.length === 0
              ? "Add a supplier first."
              : "Add a product first."}
          </h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            A purchase needs someone you bought from and something you bought.
          </p>
          <ButtonLink
            href={
              suppliers.length === 0
                ? "/shop/suppliers/new"
                : "/shop/products/new"
            }
            className="mt-6"
          >
            {suppliers.length === 0 ? "Add a supplier" : "Add a product"}
          </ButtonLink>
        </div>
      ) : (
        <PurchaseForm suppliers={suppliers} products={products} />
      )}
    </div>
  );
}
