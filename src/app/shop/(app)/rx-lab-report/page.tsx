import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/shop/dal";
import { requireReportsUnlocked } from "@/server/shop/reportLock";
import { listRxLabRows } from "@/services/shop/rx-lab-report.service";
import {
  labReportNotes,
  labReportTotalLabel,
  rxLabTotals,
} from "@/features/shop/rx/labReport";
import { resolveDateRange } from "@/lib/date-range";
import { RxLabReportActions } from "@/features/shop/rx/RxLabReportActions";
import { inputClass } from "@/components/ui/field";
import {
  formatAmount,
  formatDate,
  formatRxNo,
  todayInKarachi,
} from "@/lib/format";

export const metadata: Metadata = { title: "RX lab report" };

export default async function RxLabReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  await requireReportsUnlocked("/shop/rx-lab-report");
  const { from, to } = resolveDateRange(await searchParams, todayInKarachi());

  const rows = await listRxLabRows({ from, to });
  const totals = rxLabTotals(rows);
  const notes = labReportNotes(totals);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/shop/rx"
          className="text-navy-500 text-sm underline underline-offset-2"
        >
          Back to RX orders
        </Link>
        <h1 className="mt-2 text-xl font-semibold">RX lab report</h1>
        <p className="text-navy-500 mt-1 max-w-prose text-sm">
          Each RX order dated within the range, in RX number order, with the
          lab&apos;s order number, what the lab charges (purchase) and what the
          shop bills (sale). Amounts are in rupees (Rs). Prices are per order,
          summed over its lenses.
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

        {rows.length > 0 && <RxLabReportActions from={from} to={to} />}
      </div>

      {rows.length === 0 ? (
        <p className="text-navy-500 text-sm">
          No RX orders dated in this range.
        </p>
      ) : (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <caption className="sr-only">
                RX orders in the range, with lab order numbers and prices
              </caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    RX no.
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Lab order no.
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Lab
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Patient / shop
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Lenses
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Purchase
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Sale
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.orderId}
                    className={`border-t border-mist-200 align-top ${row.voided ? "text-navy-400" : ""}`}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/shop/orders/${row.orderId}`}
                        className="text-accent-700 font-medium hover:underline"
                      >
                        {formatRxNo(row.rxNo)}
                      </Link>
                      {row.voided && (
                        <span className="block text-xs">Void</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.labOrderNo ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">{row.lab}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">
                        {row.patientName ?? "—"}
                      </span>
                      <span className="text-navy-400 block text-xs">
                        {row.shopName}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.lenses}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.purchase === null ? (
                        <span className="text-amber-700">no cost</span>
                      ) : (
                        formatAmount(row.purchase)
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {row.sale === null ? "—" : formatAmount(row.sale)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-mist-200 font-semibold">
                  <td className="px-4 py-2.5" colSpan={5}>
                    {labReportTotalLabel(totals)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {totals.lenses}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.purchase)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.sale)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {notes.length > 0 && (
            <div className="text-navy-500 space-y-1 border-t border-mist-200 px-4 py-3 text-xs">
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
