import Link from "next/link";
import { formatAmount, formatDate } from "@/lib/format";
import {
  soldPurchaseTotal,
  soldSaleTotal,
  type SaleReportRow,
  type SalesTotals,
} from "./report";

/**
 * One list of sales on the stock report, with its total row. Drawn once for the
 * stock orders and once for the shelf items billed with RX orders, so the two
 * read the same and cannot drift apart.
 */

const CHANNEL_LABEL = { normal: "Normal", daily: "Daily" } as const;

/** A total for display, or a dash when the line has none. */
function formatOrDash(value: number | null): string {
  return value === null ? "—" : formatAmount(value);
}

export function SalesSection({
  title,
  caption,
  rows,
  totals,
}: {
  title: string;
  /** Read by screen readers in place of the heading's context. */
  caption: string;
  rows: SaleReportRow[];
  totals: SalesTotals;
}) {
  return (
    <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
      <h2 className="border-b border-mist-200 px-4 py-3 text-sm font-semibold">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-navy-500 bg-mist-100 text-left text-xs">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Date
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Invoice no
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Product
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Purchaser name
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Shop name
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Channel
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Purchase price
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Sale price
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.lineId} className="border-t border-mist-200">
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                  {formatDate(row.date)}
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  {row.invoiceNo === null ? (
                    "—"
                  ) : (
                    <Link
                      href={`/shop/orders/${row.orderId}`}
                      className="hover:text-accent-600 font-medium"
                    >
                      {row.invoiceNo}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2.5">{row.product}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.quantity}
                </td>
                <td className="px-3 py-2.5">{row.purchaser}</td>
                <td className="px-3 py-2.5">{row.shop}</td>
                <td className="px-3 py-2.5">{CHANNEL_LABEL[row.channel]}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatOrDash(soldPurchaseTotal(row))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.salePrice === 0 ? (
                    <span className="text-amber-700">no price</span>
                  ) : (
                    formatAmount(soldSaleTotal(row))
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t border-mist-200 font-semibold">
              <td className="px-4 py-2.5" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {totals.quantity}
              </td>
              <td />
              <td />
              <td />
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatAmount(totals.atCost)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatAmount(totals.atSalePrice)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
