import type { Metadata } from "next";
import { requireUser } from "@/server/shop/dal";
import { listLedgerEntries } from "@/services/shop/ledger-report.service";
import { LEDGER_TYPE_LABEL, ledgerTotals } from "@/features/shop/ledger/summary";
import { inputClass } from "@/components/ui/field";
import { formatAmount, formatPkr, todayInKarachi } from "@/lib/format";

export const metadata: Metadata = { title: "Ledger" };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** The table shows this many entries; the totals always cover the whole range. */
const SHOWN = 500;

function isDate(value: string | undefined): value is string {
  return (
    value !== undefined &&
    DATE_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  const query = await searchParams;
  const today = todayInKarachi();
  const from = isDate(query.from) ? query.from : `${today.slice(0, 7)}-01`;
  const to = isDate(query.to) ? query.to : today;

  const entries = await listLedgerEntries({ from, to });
  const totals = ledgerTotals(entries);
  const shown = entries.slice(0, SHOWN);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Ledger</h1>
        <p className="text-navy-500 mt-1 text-sm">
          Every invoice, payment and adjustment dated within the range, across all
          customers. Amounts are in rupees (Rs).
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-500 text-xs">From</span>
          <input type="date" name="from" defaultValue={from} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-500 text-xs">To</span>
          <input type="date" name="to" defaultValue={to} className={inputClass} />
        </label>
        <button
          type="submit"
          className="bg-navy-500 rounded-xl px-4 py-2 text-sm font-medium text-white"
        >
          Show
        </button>
      </form>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="shadow-lift rounded-2xl bg-white p-4">
          <p className="text-navy-500 text-xs">Invoiced</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPkr(totals.invoiced)}</p>
        </div>
        <div className="shadow-lift rounded-2xl bg-white p-4">
          <p className="text-navy-500 text-xs">Received</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPkr(totals.received)}</p>
        </div>
        <div className="shadow-lift rounded-2xl bg-white p-4">
          <p className="text-navy-500 text-xs">Adjustments</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPkr(totals.adjustments)}</p>
        </div>
        <div className="shadow-lift rounded-2xl bg-white p-4">
          <p className="text-navy-500 text-xs">Net movement</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPkr(totals.net)}</p>
        </div>
      </section>

      {entries.length === 0 ? (
        <p className="text-navy-500 text-sm">No ledger entries in this range.</p>
      ) : (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <caption className="sr-only">Ledger entries in the range</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Shop</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Method</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry) => (
                  <tr key={entry.id} className="border-t border-mist-200">
                    <td className="px-4 py-2.5 tabular-nums">{entry.entryDate}</td>
                    <td className="px-3 py-2.5">{entry.customerName}</td>
                    <td className="px-3 py-2.5">{entry.shopName}</td>
                    <td className="px-3 py-2.5">{LEDGER_TYPE_LABEL[entry.entryType]}</td>
                    <td className="px-3 py-2.5">{entry.paymentMethod ?? "–"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entries.length > SHOWN ? (
            <p className="text-navy-500 border-t border-mist-200 px-4 py-3 text-xs">
              Showing the latest {SHOWN} of {entries.length} entries. The totals above
              cover all of them.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
