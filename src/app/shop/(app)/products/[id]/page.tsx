import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getProduct } from "@/services/shop/product.service";
import {
  listBinsForProduct,
  listMovements,
} from "@/services/shop/stock.service";
import { ProductForm } from "@/features/shop/products/ProductForm";
import { StockPanel } from "@/features/shop/products/StockPanel";
import { RangeFillPanel } from "@/features/shop/products/RangeFillPanel";
import { archiveProductAction } from "@/features/shop/products/actions";
import { formatDateTime, formatPower } from "@/lib/format";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({
  params,
}: PageProps<"/shop/products/[id]">) {
  await requireUser();
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) notFound();

  // Independent reads, so they go together rather than in series.
  const [bins, movements] = await Promise.all([
    listBinsForProduct(id),
    listMovements(id, 25),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/shop/products"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Products
      </Link>

      <h1 className="text-2xl font-bold">{product.name}</h1>
      <p className="text-navy-500 mt-1 mb-6 font-mono text-sm">{product.sku}</p>

      <div className="space-y-5">
        <RangeFillPanel product={product} />
        <StockPanel product={product} bins={bins} />
      </div>

      {movements.length > 0 && (
        <section className="shadow-lift mt-5 rounded-2xl bg-white p-5">
          <h2 className="text-base font-semibold">Recent movements</h2>
          <ul className="mt-3 divide-y divide-mist-200 text-sm">
            {movements.map((move) => (
              <li key={move.id} className="flex items-baseline gap-3 py-2">
                <span
                  className={`w-14 shrink-0 text-right font-medium tabular-nums ${
                    move.delta > 0 ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {move.delta > 0 ? "+" : ""}
                  {move.delta}
                </span>
                {product.tracks_power && (
                  <span className="text-navy-500 w-16 shrink-0 font-mono text-xs">
                    {formatPower(move.sph)}
                  </span>
                )}
                <span className="text-navy-600 min-w-0 flex-1 truncate">
                  {move.reason}
                  {move.note ? ` — ${move.note}` : ""}
                </span>
                <span className="text-navy-400 shrink-0 text-xs">
                  {formatDateTime(move.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mt-10 mb-4 text-lg font-semibold">Details</h2>
      <ProductForm product={product} />

      <form
        action={archiveProductAction}
        className="mt-10 border-t border-mist-200 pt-6"
      >
        <input type="hidden" name="id" value={product.id} />
        <h2 className="text-sm font-semibold">Archive this product</h2>
        <p className="text-navy-500 mt-1 max-w-prose text-sm">
          It stops appearing when building an invoice. Invoices already issued
          keep their own copy of the name and rate, so nothing printed changes.
        </p>
        <button
          type="submit"
          className="mt-3 rounded-lg px-3 py-2 text-sm font-medium text-amber-700 ring-1 ring-amber-300 transition-colors ring-inset hover:bg-amber-50"
        >
          Archive product
        </button>
      </form>
    </div>
  );
}
