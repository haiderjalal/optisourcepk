import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listCustomers } from "@/services/shop/customer.service";
import { listSellableProducts } from "@/services/shop/product.service";
import { OrderBuilder } from "@/features/shop/orders/OrderBuilder";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "New daily order" };

/**
 * A counter sale from the daily register: shop, who ordered, who it goes to,
 * each item with its power, purchase and sale price — invoiced on save.
 */
export default async function NewDailyOrderPage() {
  await requireUser();

  const [customers, allProducts] = await Promise.all([
    listCustomers(),
    listSellableProducts(),
  ]);
  // The same items the daily register counts.
  const products = allProducts.filter(
    (product) => !product.is_rx && product.category !== "services",
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/shop/stock/daily"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Daily stock
      </Link>

      <h1 className="text-2xl font-bold">New daily order</h1>
      <p className="text-navy-500 mt-2 mb-6 max-w-prose text-sm">
        Pick the shop the invoice is for, add each item with its power, purchase
        and sale price. Saving issues the invoice — ready to view, download or
        share — posts it to the shop&rsquo;s account, and adds the items to
        today&rsquo;s outgoing in the daily register.
      </p>

      {customers.length === 0 || products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-12 text-center">
          <h2 className="font-semibold">
            {customers.length === 0
              ? "Add a customer first."
              : "Add a product first."}
          </h2>
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
        <OrderBuilder customers={customers} products={products} daily />
      )}
    </div>
  );
}
