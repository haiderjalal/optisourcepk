import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listCustomers } from "@/services/shop/customer.service";
import { listSellableProducts } from "@/services/shop/product.service";
import { OrderBuilder } from "@/features/shop/orders/OrderBuilder";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  await requireUser();

  const [customers, products] = await Promise.all([
    listCustomers(),
    listSellableProducts(),
  ]);

  const blocked = customers.length === 0 || products.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/shop/orders"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Orders
      </Link>

      <h1 className="mb-6 text-2xl font-bold">New order</h1>

      {blocked ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-12 text-center">
          <h2 className="font-semibold">
            {customers.length === 0
              ? "Add a customer first."
              : "Add a product first."}
          </h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            An order needs a shop to bill and something to sell.
          </p>
          <ButtonLink
            href={
              customers.length === 0
                ? "/shop/customers/new"
                : "/shop/products/new"
            }
            className="mt-6"
          >
            {customers.length === 0 ? "Add a customer" : "Add a product"}
          </ButtonLink>
        </div>
      ) : (
        <OrderBuilder customers={customers} products={products} />
      )}
    </div>
  );
}
