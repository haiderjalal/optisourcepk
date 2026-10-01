import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  CalendarDays,
  ChevronRight,
  PackagePlus,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listAllStock, listDailyStock } from "@/services/shop/stock.service";
import { listSellableProducts } from "@/services/shop/product.service";
import { QuickReceive } from "@/features/shop/products/QuickReceive";
import { ButtonLink } from "@/components/ui/button";
import { StockSheetPanel } from "@/features/shop/stock/StockSheetPanel";
import { stockSheetFileName } from "@/features/shop/stock/pdf/render";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  await requireUser();
  const [products, sellable, daily] = await Promise.all([
    listAllStock(),
    listSellableProducts(),
    listDailyStock(),
  ]);

  // Services are billed per job and never held, so they are not offered here.
  const stockable = sellable.filter((p) => p.tracks_stock);

  const empty = products.filter((p) => p.bins.length === 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Inventory</p>
          <h1 className="mt-2 text-2xl font-bold">Stock</h1>
          <p className="text-navy-500 mt-2 max-w-prose text-sm">
            Everything you hold, by power. Receive stock below, or open a
            product for its full history.
          </p>
        </div>
        <ButtonLink href="/shop/products/new" variant="outline">
          <Plus className="size-4" aria-hidden />
          Add product
        </ButtonLink>
      </div>

      <section className="shadow-lift mb-5 overflow-hidden rounded-2xl bg-white">
        <div className="flex items-center gap-2 border-b border-mist-200 px-5 py-4">
          <CalendarDays className="text-accent-600 size-4" aria-hidden />
          <div>
            <h2 className="text-base font-semibold">Daily stock</h2>
            <p className="text-navy-500 mt-0.5 text-xs">
              Today&rsquo;s opening, incoming and outgoing quantities—including
              stock received in the morning and sold the same day.
            </p>
          </div>
        </div>
        {daily.length === 0 ? (
          <p className="text-navy-500 px-5 py-6 text-sm">
            No stock has moved today.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">
                Today&rsquo;s stock movement
              </caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Product
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Opening
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    In
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Out
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-right font-medium"
                  >
                    Closing
                  </th>
                </tr>
              </thead>
              <tbody>
                {daily.map((row) => (
                  <tr key={row.productId} className="border-t border-mist-200">
                    <td className="px-5 py-2.5 font-medium">
                      <Link
                        href={`/shop/products/${row.productId}`}
                        className="hover:text-accent-700"
                      >
                        {row.productName}
                      </Link>
                      <span className="text-navy-400 ml-1 text-xs">
                        {row.unit}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.opening}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700 tabular-nums">
                      +{row.received}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-700 tabular-nums">
                      −{row.issued}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                      {row.closing}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Boxes className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">Nothing to stock yet.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            Add a product first, then receive stock against it.
          </p>
          <ButtonLink href="/shop/products/new" className="mt-6">
            <Plus className="size-4" aria-hidden />
            Add a product
          </ButtonLink>
        </div>
      ) : (
        <>
          <QuickReceive
            products={stockable}
            bins={products.flatMap((p) => p.bins)}
          />

          {empty.length > 0 && (
            <div className="mb-5 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200 ring-inset">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <TriangleAlert className="size-4" aria-hidden />
                {empty.length}{" "}
                {empty.length === 1 ? "product has" : "products have"} no stock
                received
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                An invoice cannot be issued for a product until stock has been
                received for that exact power.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {empty.map((product) => (
                  <li key={product.productId}>
                    <Link
                      href={`/shop/products/${product.productId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200 transition-colors ring-inset hover:bg-amber-100"
                    >
                      <PackagePlus className="size-3.5" aria-hidden />
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-navy-500 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>Click a product to open its stock sheet.</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded-sm ring-2 ring-red-500 ring-inset"
                aria-hidden
              />
              none in stock
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded-sm bg-amber-50 ring-1 ring-amber-300 ring-inset"
                aria-hidden
              />
              at or below the alert quantity
            </span>
          </p>

          <div className="space-y-3">
            {products.map((product) => (
              <details
                key={product.productId}
                className="shadow-lift group rounded-2xl bg-white"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl p-5 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="text-navy-400 size-4 shrink-0 transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 font-semibold">
                    {product.name}
                  </span>
                  {product.emptyCount > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-300 ring-inset">
                      {product.emptyCount} at 0
                    </span>
                  )}
                  {product.lowCount > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
                      {product.lowCount} low
                    </span>
                  )}
                  <span className="text-navy-500 text-sm tabular-nums">
                    {product.total} {product.unit}
                  </span>
                </summary>

                <div className="px-5 pb-5">
                  {product.sheets.length > 0 ? (
                    <StockSheetPanel
                      sheets={product.sheets}
                      productId={product.productId}
                      productName={product.name}
                      fileName={stockSheetFileName(product.name)}
                    />
                  ) : product.bins.length === 0 ? (
                    <p className="text-navy-400 text-sm">
                      No stock received yet.
                    </p>
                  ) : (
                    <p className="text-2xl font-semibold tabular-nums">
                      {product.total}
                      <span className="text-navy-400 ml-2 text-sm font-normal">
                        {product.unit}
                      </span>
                    </p>
                  )}

                  <ButtonLink
                    href={`/shop/products/${product.productId}`}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    <PackagePlus className="size-4" aria-hidden />
                    Open product · receive stock
                  </ButtonLink>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
