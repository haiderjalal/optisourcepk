import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/shop/dal";
import { loadStockReport } from "@/services/shop/stock-report.service";
import {
  stockReportNotes,
  stockReportTotals,
} from "@/features/shop/stock/report";
import { ReportPdfActions } from "@/features/shop/pdf/ReportPdfActions";
import { pdfFileName } from "@/features/shop/pdf/pdfResponse";
import { inputClass } from "@/components/ui/field";
import { resolveDateRange } from "@/lib/date-range";
import { formatAmount, formatDate, todayInKarachi } from "@/lib/format";

export const metadata: Metadata = { title: "Stock report" };

const CHANNEL_LABEL = { normal: "Normal", daily: "Daily" } as const;

export default async function StockReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  const { from, to } = resolveDateRange(await searchParams, todayInKarachi());

  const report = await loadStockReport({ from, to });
  const totals = stockReportTotals(report);
  const notes = stockReportNotes(totals);
  const hasRows =
    report.purchases.length + report.register.length + report.sales.length > 0;

  const pdfPath = `/shop/stock-report/pdf?${new URLSearchParams({ from, to })}`;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/shop/stock"
          className="text-navy-500 text-sm underline underline-offset-2"
        >
          Back to stock
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Stock report</h1>
        <p className="text-navy-500 mt-1 max-w-prose text-sm">
          What was bought from suppliers, the daily stock register day by day,
          and what was sold on invoices from normal and daily stock. Amounts are
          in rupees (Rs).
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-500 text-xs">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-500 text-xs">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="bg-navy-500 rounded-xl px-4 py-2 text-sm font-medium text-white"
          >
            Show
          </button>
        </form>

        {hasRows && (
          <ReportPdfActions
            pdfPath={pdfPath}
            fileName={pdfFileName("Stock-Report", `${from} to ${to}`)}
            shareText={`OptiSource PK — stock report, ${formatDate(from)} to ${formatDate(to)}`}
            printFrameId="stock-report-print"
          />
        )}
      </div>

      {!hasRows && (
        <p className="text-navy-500 text-sm">
          Nothing was bought, recorded or sold in this range.
        </p>
      )}

      {report.purchases.length > 0 && (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <h2 className="border-b border-mist-200 px-4 py-3 text-sm font-semibold">
            Purchases from suppliers
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <caption className="sr-only">Purchases in the range</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Invoice
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Supplier
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Power
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Qty
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Purchased price
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Sale price
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.purchases.map((row) => (
                  <tr key={row.lineId} className="border-t border-mist-200">
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.invoiceNo}
                    </td>
                    <td className="px-3 py-2.5">{row.supplier}</td>
                    <td className="px-3 py-2.5">{row.product}</td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                      {row.power}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(row.purchasedPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.salePrice === null
                        ? "—"
                        : formatAmount(row.salePrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatAmount(row.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-mist-200 font-semibold">
                  <td className="px-4 py-2.5" colSpan={5}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {totals.purchasedQuantity}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.purchasedAtCost)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.purchasedAtSalePrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.purchasedAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.register.length > 0 && (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <h2 className="border-b border-mist-200 px-4 py-3 text-sm font-semibold">
            Daily stock register
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <caption className="sr-only">
                The daily stock register in the range
              </caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Item
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Unit
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
                    Received
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Sold
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Closing
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.register.map((row) => (
                  <tr key={row.entryId} className="border-t border-mist-200">
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-2.5">{row.product}</td>
                    <td className="px-3 py-2.5">{row.unit}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.opening}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.received}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.outgoing}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {row.closing}
                    </td>
                    <td className="text-navy-500 px-4 py-2.5">
                      {row.note ?? ""}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-mist-200 font-semibold">
                  <td className="px-4 py-2.5" colSpan={4}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {totals.received}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {totals.sold}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.sales.length > 0 && (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <h2 className="border-b border-mist-200 px-4 py-3 text-sm font-semibold">
            Sales on invoices (normal and daily stock)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <caption className="sr-only">
                Sales on issued invoices in the range
              </caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Invoice
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Channel
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Shop
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Item
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Qty
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Purchased price
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Sale price
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.sales.map((row) => (
                  <tr key={row.lineId} className="border-t border-mist-200">
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.invoiceNo === null ? "—" : row.invoiceNo}
                    </td>
                    <td className="px-3 py-2.5">
                      {CHANNEL_LABEL[row.channel]}
                    </td>
                    <td className="px-3 py-2.5">{row.shop}</td>
                    <td className="px-3 py-2.5">{row.product}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.purchasedPrice === null
                        ? "—"
                        : formatAmount(row.purchasedPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(row.salePrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {row.salePrice === 0 ? (
                        <span className="text-amber-700">no price</span>
                      ) : (
                        formatAmount(row.amount)
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-mist-200 font-semibold">
                  <td className="px-4 py-2.5" colSpan={5}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {totals.soldQuantity}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.soldAtCost)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.soldAtSalePrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.soldAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {notes.length > 0 && hasRows && (
        <div className="text-navy-500 space-y-1 text-xs">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
    </div>
  );
}
