import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listCustomers } from "@/services/shop/customer.service";
import { listRxProducts } from "@/services/shop/product.service";
import { listSuppliers } from "@/services/shop/supplier.service";
import { RxOrderForm } from "@/features/shop/rx/RxOrderForm";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "New RX order" };

/** An RX order: lenses made by a lab for this job. Nothing comes off stock. */
export default async function NewRxOrderPage() {
  await requireUser();

  const [customers, products, suppliers] = await Promise.all([
    listCustomers(),
    listRxProducts(),
    listSuppliers(),
  ]);

  // Products are typed on an RX order, so only a customer is needed first.
  const blocked = customers.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/shop/rx"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        RX orders
      </Link>

      <h1 className="text-2xl font-bold">New RX order</h1>
      <p className="text-navy-500 mt-2 mb-6 max-w-prose text-sm">
        For lenses ordered from a lab. Type the product, its power, the sale
        price and what the lab charges. A product you have not used before is
        saved for next time. No stock is checked or deducted.
      </p>

      {blocked ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-12 text-center">
          <h2 className="font-semibold">Add a customer first.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            An RX order needs a shop to bill.
          </p>
          <ButtonLink href="/shop/customers/new" className="mt-6">
            Add a customer
          </ButtonLink>
        </div>
      ) : (
        <RxOrderForm
          customers={customers}
          products={products}
          suppliers={suppliers}
        />
      )}
    </div>
  );
}
