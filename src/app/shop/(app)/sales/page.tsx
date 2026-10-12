import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/shop/dal";
import { listMonthlySales } from "@/services/shop/sales-report.service";
import {
  CHANNELS,
  CHANNEL_LABEL,
  type MonthRow,
} from "@/features/shop/sales/monthly";
import { formatAmount } from "@/lib/format";

export const metadata: Metadata = { title: "Monthly sales" };

const MONTH_NAME = new Intl.DateTimeFormat("en-PK", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function profitOf(row: MonthRow): number {
  return CHANNELS.reduce((total, channel) => total + row.channels[channel].profit, 0);
}

function linesWithoutCostOf(row: MonthRow): number {
  return CHANNELS.reduce(
    (total, channel) => total + row.channels[channel].linesWithoutCost,
    0,
  );
}

export default async function SalesPage() {
  await requireUser();
  const months = await listMonthlySales(12);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Monthly sales</h1>
        <p className="text-navy-500 mt-1 text-sm">
          Issued invoices only, voids excluded. Sales are line totals after
          discount, before freight and tax. Amounts are in rupees (Rs). Profit
          counts only lines that store a cost; lines without one are counted
          separately.
        </p>
      </header>

      {months.length === 0 ? (
        <p className="text-navy-500 text-sm">No sales invoiced yet.</p>
      ) : (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <caption className="sr-only">Monthly sales by channel</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Month
                  </th>
                  {CHANNELS.map((channel) => (
                    <th
                      key={channel}
                      scope="col"
                      className="px-3 py-2.5 text-right font-medium"
                    >
                      {CHANNEL_LABEL[channel]}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Total sales
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Returns
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Net sales
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Profit (known cost)
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Lines without cost
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((row) => (
                  <tr key={row.month} className="border-t border-mist-200">
                    <td className="px-4 py-2.5 font-medium">
                      {MONTH_NAME.format(new Date(`${row.month}-01T00:00:00Z`))}
                    </td>
                    {CHANNELS.map((channel) => (
                      <td key={channel} className="px-3 py-2.5 text-right tabular-nums">
                        {formatAmount(row.channels[channel].sales)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {formatAmount(row.sales)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(row.returns)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(row.net)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(profitOf(row))}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {linesWithoutCostOf(row)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/shop/sales/${row.month}`}
                        className="underline underline-offset-2"
                      >
                        Products
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
