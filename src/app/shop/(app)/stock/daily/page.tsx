import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listSellableProducts } from "@/services/shop/product.service";
import { listDailyStockEntries } from "@/services/shop/daily-stock.service";
import { DailyStockForm } from "@/features/shop/stock/DailyStockForm";
import { formatDate } from "@/lib/format";
import { ShowMore } from "@/components/ui/show-more";
import { listLimit } from "@/lib/list-pagination";

export const metadata: Metadata = { title: "Daily stock register" };

export default async function DailyStockPage({
  searchParams,
}: PageProps<"/shop/stock/daily">) {
  await requireUser();
  const params = await searchParams;
  const limit = listLimit(params.limit);
  const [allProducts, register] = await Promise.all([
    listSellableProducts(),
    // The form uses recent history to prefill corrections and carry a prior
    // closing balance forward; the table below still renders only five.
    listDailyStockEntries(Math.max(180, limit + 1)),
  ]);
  // null: the register's table is not in the database yet (migration 0029).
  const history = register ?? [];
  const hasMore = history.length > limit;
  const visibleHistory = history.slice(0, limit);
  const products = allProducts.filter(
    (product) => !product.is_rx && product.category !== "services",
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/shop/stock"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Stock
      </Link>

      <div className="mb-6">
        <p className="eyebrow text-accent-600">Inventory</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
          <CalendarDays className="text-accent-600 size-6" aria-hidden />
          Daily stock register
        </h1>
        <p className="text-navy-500 mt-2 max-w-2xl text-sm">
          Record fast-moving items separately by business date. This register
          keeps its own history and does not alter your permanent stock bins.
        </p>
      </div>

      {register === null ? (
        <div
          role="alert"
          className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset"
        >
          <p className="font-semibold">
            The daily stock register is not set up in the database yet.
          </p>
          <p className="mt-1">
            Open the Supabase SQL Editor, run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0029_daily_stock_register.sql
            </code>
            , then reload this page.
          </p>
        </div>
      ) : products.length > 0 ? (
        <DailyStockForm products={products} history={visibleHistory} />
      ) : (
        <p className="text-navy-500 rounded-2xl border border-dashed border-mist-300 bg-white/60 px-5 py-8 text-sm">
          Add a non-service product before entering daily stock.
        </p>
      )}

      {register !== null && (
        <section className="shadow-lift mt-5 overflow-hidden rounded-2xl bg-white">
          <div className="border-b border-mist-200 px-5 py-4">
            <h2 className="text-base font-semibold">Daily stock history</h2>
            <p className="text-navy-500 mt-1 text-xs">
              The most recent item-days appear first.
            </p>
          </div>

          {history.length === 0 ? (
            <p className="text-navy-500 px-5 py-8 text-sm">
              No daily stock has been entered yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Daily stock history</caption>
                <thead>
                  <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Item
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
                      className="px-3 py-2.5 text-right font-medium"
                    >
                      Closing
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((row) => (
                    <tr key={row.id} className="border-t border-mist-200">
                      <td className="px-5 py-2.5 whitespace-nowrap">
                        {formatDate(row.entry_date)}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        {row.product_name}
                        <span className="text-navy-400 ml-1 text-xs">
                          {row.unit}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.opening_qty}
                      </td>
                      <td className="px-3 py-2.5 text-right text-emerald-700 tabular-nums">
                        +{row.received_qty}
                      </td>
                      <td className="px-3 py-2.5 text-right text-amber-700 tabular-nums">
                        −{row.outgoing_qty}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {row.closing_qty}
                      </td>
                      <td className="text-navy-500 max-w-64 px-5 py-2.5">
                        {row.note ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ShowMore
                pathname="/shop/stock/daily"
                searchParams={params}
                current={limit}
                hasMore={hasMore}
                noun="entries"
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
