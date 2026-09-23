import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getSupplier } from "@/services/shop/supplier.service";
import { listPurchases } from "@/services/shop/purchase.service";
import { SupplierForm } from "@/features/shop/suppliers/SupplierForm";
import { PurchaseTable } from "@/features/shop/purchases/PurchaseTable";

export const metadata: Metadata = { title: "Supplier" };

export default async function SupplierPage({
  params,
}: PageProps<"/shop/suppliers/[id]">) {
  await requireUser();
  const { id } = await params;

  const [supplier, purchases] = await Promise.all([
    getSupplier(id),
    listPurchases({ supplierId: id }),
  ]);
  if (!supplier) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/shop/suppliers"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Suppliers
      </Link>

      <h1 className="mb-6 text-2xl font-bold">{supplier.name}</h1>

      <h2 className="mb-3 text-lg font-semibold">Purchase invoices</h2>
      {purchases.length === 0 ? (
        <p className="text-navy-500 mb-8 text-sm">
          Nothing bought from {supplier.name} yet.{" "}
          <Link
            href="/shop/purchases/new"
            className="text-accent-600 hover:text-accent-700 font-medium"
          >
            Record a purchase
          </Link>
        </p>
      ) : (
        <div className="mb-8">
          <PurchaseTable purchases={purchases} showSupplier={false} />
        </div>
      )}

      <h2 className="mb-4 text-lg font-semibold">Details</h2>
      <SupplierForm supplier={supplier} />
    </div>
  );
}
