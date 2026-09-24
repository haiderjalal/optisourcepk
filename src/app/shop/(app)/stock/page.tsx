import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  ChevronRight,
  PackagePlus,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listAllStock } from "@/services/shop/stock.service";
import { listSellableProducts } from "@/services/shop/product.service";
import { QuickReceive } from "@/features/shop/products/QuickReceive";
import { ButtonLink } from "@/components/ui/button";
import { StockSheetTable } from "@/features/shop/products/StockSheetTable";
import { StockSheetActions } from "@/features/shop/stock/StockSheetActions";
import { stockSheetFileName } from "@/features/shop/stock/pdf/render";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  await requireUser();
  const [products, sellable] = await Promise.all([
    listAllStock(),
    listSellableProducts(),
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
          <QuickReceive products={stockable} />

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
                  {product.sheet ? (
                    <>
                      <StockSheetTable sheet={product.sheet} />
                      {product.sheet.mixesAddOrEye && (
                        <p className="text-navy-400 mt-2 text-xs">
                          Some of this stock is split by ADD or eye; each square
                          adds those together. The product page has the detail.
                        </p>
                      )}
                    </>
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

                  <div className="mt-4 flex flex-wrap items-start gap-2">
                    {product.sheet && (
                      <StockSheetActions
                        productId={product.productId}
                        productName={product.name}
                        fileName={stockSheetFileName(product.name)}
                      />
                    )}
                    <ButtonLink
                      href={`/shop/products/${product.productId}`}
                      variant="outline"
                      size="sm"
                    >
                      <PackagePlus className="size-4" aria-hidden />
                      Open product · receive stock
                    </ButtonLink>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
