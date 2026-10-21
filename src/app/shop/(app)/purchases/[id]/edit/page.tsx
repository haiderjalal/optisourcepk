import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getPurchase } from "@/services/shop/purchase.service";
import { listSuppliers } from "@/services/shop/supplier.service";
import { listSellableProducts } from "@/services/shop/product.service";
import {
  PurchaseForm,
  type PurchaseSeed,
} from "@/features/shop/purchases/PurchaseForm";

export const metadata: Metadata = { title: "Edit purchase" };

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [purchase, suppliers, products] = await Promise.all([
    getPurchase(id),
    listSuppliers(),
    listSellableProducts(),
  ]);
  if (!purchase) notFound();

  const seed: PurchaseSeed = {
    id: purchase.id,
    supplierId: purchase.supplier_id,
    invoiceNo: purchase.invoice_no,
    invoiceDate: purchase.invoice_date,
    notes: purchase.notes ?? "",
    lines: purchase.lines.map((line) => ({
      productId: line.product_id,
      eye: line.eye ?? "",
      sph: line.sph,
      cyl: line.cyl,
      add: line.add_power,
      qty: line.quantity,
      unitCost: line.unit_cost,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/shop/purchases/${id}`}
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {purchase.invoice_no}
      </Link>

      <h1 className="mb-6 text-2xl font-bold">Edit purchase</h1>

      <PurchaseForm suppliers={suppliers} products={products} purchase={seed} />
    </div>
  );
}
