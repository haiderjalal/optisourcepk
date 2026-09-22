import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, PackagePlus, Plus, TriangleAlert } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listAllStock } from "@/services/shop/stock.service";
import { ButtonLink } from "@/components/ui/button";
import { describeBin } from "@/features/shop/products/StockPanel";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  await requireUser();
  const products = await listAllStock();

  const empty = products.filter((p) => p.bins.length === 0);
  const lowTotal = products.reduce((sum, p) => sum + p.lowCount, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Inventory</p>
          <h1 className="mt-2 text-2xl font-bold">Stock</h1>
          <p className="text-navy-500 mt-2 max-w-prose text-sm">
            Everything you hold, by power. Open a product to receive stock or
            adjust a count.
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

          {lowTotal > 0 && (
            <p className="text-navy-500 mb-4 text-sm">
              {lowTotal} {lowTotal === 1 ? "bin is" : "bins are"} at or below
              the reorder level — shown in amber.
            </p>
          )}

          <div className="space-y-4">
            {products.map((product) => (
              <section
                key={product.productId}
                className="shadow-lift rounded-2xl bg-white p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/shop/products/${product.productId}`}
                      className="hover:text-accent-600 font-semibold"
                    >
                      {product.name}
                    </Link>
                    <span className="text-navy-400 ml-2 font-mono text-xs">
                      {product.sku}
                    </span>
                  </div>
                  <p className="text-navy-500 text-sm">
                    {product.total} {product.unit}
                    {product.tracksPower &&
                      product.bins.length > 0 &&
                      ` · ${product.bins.length} powers`}
                  </p>
                </div>

                {product.bins.length === 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-navy-400 text-sm">
                      No stock received yet.
                    </p>
                    <ButtonLink
                      href={`/shop/products/${product.productId}`}
                      variant="outline"
                      size="sm"
                    >
                      <PackagePlus className="size-4" aria-hidden />
                      Receive stock
                    </ButtonLink>
                  </div>
                ) : product.tracksPower ? (
                  <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-10">
                    {product.bins.map((bin) => (
                      <li
                        key={bin.id}
                        className={`rounded-lg px-2 py-1.5 text-center ${
                          bin.qty_on_hand <= bin.reorder_level
                            ? "bg-amber-50 ring-1 ring-amber-200 ring-inset"
                            : "bg-mist-100"
                        }`}
                      >
                        <span className="text-navy-500 block font-mono text-[11px]">
                          {describeBin(bin)}
                        </span>
                        <span className="block text-base font-semibold tabular-nums">
                          {bin.qty_on_hand}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {product.bins[0].qty_on_hand}
                    <span className="text-navy-400 ml-2 text-sm font-normal">
                      {product.unit}
                    </span>
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
