import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listProducts } from "@/services/shop/product.service";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { formatAmount } from "@/lib/format";
import { ArchiveButton } from "@/features/shop/products/ArchiveButton";
import { archiveProductAction } from "@/features/shop/products/actions";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: PageProps<"/shop/products">) {
  await requireUser();

  const { q } = await searchParams;
  const search = typeof q === "string" ? q : undefined;
  const products = await listProducts(search);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Catalogue</p>
          <h1 className="mt-2 text-2xl font-bold">Products</h1>
        </div>
        <ButtonLink href="/shop/products/new">
          <Plus className="size-4" aria-hidden />
          Add product
        </ButtonLink>
      </div>

      <form className="mb-5 flex gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-navy-300 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Name or SKU"
            aria-label="Search products"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button
          type="submit"
          className="text-navy-600 rounded-lg border border-mist-300 bg-white px-4 text-sm font-medium transition-colors hover:bg-mist-100"
        >
          Search
        </button>
      </form>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Package className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">
            {search ? "No products matched." : "No products yet."}
          </h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            {search
              ? "Try part of the name or the SKU."
              : "Add what you sell — lenses by power, frames and accessories by piece, and coatings and tints as services."}
          </p>
          {!search && (
            <ButtonLink href="/shop/products/new" className="mt-6">
              <Plus className="size-4" aria-hidden />
              Add the first product
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Products with their rate and quantity on hand
            </caption>
            <thead>
              <tr className="text-navy-500 bg-mist-100 text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  Product
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-medium sm:table-cell"
                >
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Rate (Rs)
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  On hand
                </th>
                <th scope="col" className="w-28 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-mist-200 hover:bg-mist-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/shop/products/${product.id}`}
                      className="hover:text-accent-600 font-medium"
                    >
                      {product.name}
                    </Link>
                    <span className="text-navy-400 block font-mono text-xs">
                      {product.sku}
                      {product.tracks_power && " · by power"}
                    </span>
                  </td>
                  <td className="text-navy-500 hidden px-4 py-3 sm:table-cell">
                    {product.category}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatAmount(product.list_price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {product.tracks_stock ? (
                      <>
                        <span className="font-medium tabular-nums">
                          {product.totalQty}
                        </span>
                        {product.tracks_power && product.binCount > 0 && (
                          <span className="text-navy-400 block text-xs">
                            {product.binCount} powers
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-navy-300 text-xs">service</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ArchiveButton
                      action={archiveProductAction}
                      id={product.id}
                      name={product.name}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
