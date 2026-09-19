import type { Metadata } from "next";
import Link from "next/link";
import { PackageCheck, TriangleAlert } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listLowStock } from "@/services/shop/stock.service";
import { ButtonLink } from "@/components/ui/button";
import { formatPower } from "@/lib/format";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  await requireUser();
  const low = await listLowStock();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="eyebrow text-accent-600">Inventory</p>
        <h1 className="mt-2 text-2xl font-bold">Running low</h1>
        <p className="text-navy-500 mt-2 max-w-prose text-sm">
          Every bin at or below its reorder level. Stock is received on the
          product itself — open a product to add powers.
        </p>
      </div>

      {low.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <PackageCheck className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">Nothing is running low.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            Set a reorder level on a bin and it will appear here once the count
            drops to it.
          </p>
          <ButtonLink href="/shop/products" variant="outline" className="mt-6">
            Go to products
          </ButtonLink>
        </div>
      ) : (
        <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Bins at or below reorder level
            </caption>
            <thead>
              <tr className="text-navy-500 bg-mist-100 text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Power
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  On hand
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Reorder at
                </th>
              </tr>
            </thead>
            <tbody>
              {low.map((line) => (
                <tr
                  key={line.bin_id}
                  className="border-t border-mist-200 hover:bg-mist-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/shop/products/${line.product_id}`}
                      className="hover:text-accent-600 font-medium"
                    >
                      {line.name}
                    </Link>
                    <span className="text-navy-400 block font-mono text-xs">
                      {line.sku}
                    </span>
                  </td>
                  <td className="text-navy-600 px-4 py-3 font-mono">
                    {line.sph === null ? "—" : formatPower(line.sph)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-700 tabular-nums">
                    <TriangleAlert
                      className="mr-1 inline size-3.5 align-[-2px]"
                      aria-hidden
                    />
                    {line.qty_on_hand}
                  </td>
                  <td className="text-navy-500 px-4 py-3 text-right tabular-nums">
                    {line.reorder_level}
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
