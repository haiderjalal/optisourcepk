import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/shop/dal";
import { requireReportsUnlocked } from "@/server/shop/reportLock";
import { listMonthProducts } from "@/services/shop/sales-report.service";
import { CHANNEL_LABEL } from "@/features/shop/sales/monthly";
import { formatAmount } from "@/lib/format";

export const metadata: Metadata = { title: "Monthly sales by product" };

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAME = new Intl.DateTimeFormat("en-PK", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function MonthProductsPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  if (!MONTH_PATTERN.test(month)) notFound();

  await requireUser();
  await requireReportsUnlocked(`/shop/sales/${month}`);
  const products = await listMonthProducts(month);
  const totalSales = products.reduce((total, row) => total + row.sales, 0);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/shop/sales" className="text-navy-500 text-sm underline underline-offset-2">
          Back to monthly sales
        </Link>
        <h1 className="mt-2 text-xl font-semibold">
          Sales by product, {MONTH_NAME.format(new Date(`${month}-01T00:00:00Z`))}
        </h1>
        <p className="text-navy-500 mt-1 text-sm">
          Issued invoices only, voids excluded. Amounts are in rupees (Rs). Returns
          are counted in the monthly totals, not against individual products.
        </p>
      </header>

      {products.length === 0 ? (
        <p className="text-navy-500 text-sm">No sales invoiced in this month.</p>
      ) : (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <caption className="sr-only">Sales by product for the month</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Channel
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Sales
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Cost
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Profit (known cost)
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Lines without cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => (
                  <tr
                    key={`${row.channel}:${row.productId}`}
                    className="border-t border-mist-200"
                  >
                    <td className="px-4 py-2.5 font-medium">{row.productName}</td>
                    <td className="px-3 py-2.5">{CHANNEL_LABEL[row.channel]}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.quantity}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(row.sales)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(row.cost)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(row.profit)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.linesWithoutCost}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-mist-200 font-semibold">
                  <td className="px-4 py-2.5" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAmount(totalSales)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
