import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/shop/dal";
import { listCustomers } from "@/services/shop/customer.service";
import {
  getBusinessTotals,
  listRecentPayments,
} from "@/services/shop/ledger.service";
import { PaymentForm } from "@/features/shop/payments/PaymentForm";
import { ShopPageHeader } from "@/features/shop/layout/ShopPageHeader";
import { ButtonLink } from "@/components/ui/button";
import { formatAmount, formatDate } from "@/lib/format";
import { ShowMore } from "@/components/ui/show-more";
import { listLimit } from "@/lib/list-pagination";

export const metadata: Metadata = { title: "Ledger & payments" };

export default async function PaymentsPage({
  searchParams,
}: PageProps<"/shop/payments">) {
  await requireUser();

  const params = await searchParams;
  const { customer } = params;
  const preset = typeof customer === "string" ? customer : undefined;
  const limit = listLimit(params.limit);

  const [customers, recent, totals] = await Promise.all([
    listCustomers(),
    listRecentPayments(limit + 1),
    getBusinessTotals(),
  ]);

  const shopById = new Map(customers.map((c) => [c.id, c.shop_name]));
  const hasMore = recent.length > limit;
  const visibleRecent = recent.slice(0, limit);

  return (
    <div className="mx-auto max-w-5xl">
      <ShopPageHeader
        eyebrow="Accounts"
        title="Ledger & payments"
        description="Record money received, or add and remove payment discounts. RX and stock business are counted separately below."
      />

      <section className="shadow-lift mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-mist-200 lg:grid-cols-3">
        <LedgerTotal label="Normal stock sales" value={totals.stock_sales} />
        <LedgerTotal
          label="Normal stock purchases"
          value={totals.stock_purchases}
        />
        <LedgerTotal label="Daily stock sales" value={totals.daily_sales} />
        <LedgerTotal
          label="Daily stock purchases"
          value={totals.daily_purchases}
        />
        <LedgerTotal label="RX sales" value={totals.rx_sales} />
        <LedgerTotal label="RX purchases" value={totals.rx_purchases} />
      </section>
      <p className="text-navy-400 -mt-3 mb-6 text-xs">
        Sales and purchases are all-time totals; voided invoices are excluded.
      </p>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-12 text-center">
          <h2 className="font-semibold">No customers yet.</h2>
          <ButtonLink href="/shop/customers/new" className="mt-5">
            Add a customer
          </ButtonLink>
        </div>
      ) : (
        <PaymentForm customers={customers} presetCustomerId={preset} />
      )}

      {visibleRecent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold">
            Recent ledger entries
          </h2>
          <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent ledger entries</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Customer
                  </th>
                  <th
                    scope="col"
                    className="hidden px-4 py-3 font-medium sm:table-cell"
                  >
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Amount (Rs)
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRecent.map((entry) => (
                  <tr key={entry.id} className="border-t border-mist-200">
                    <td className="text-navy-500 px-4 py-3">
                      {formatDate(entry.entry_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/shop/customers/${entry.customer_id}/statement`}
                        className="hover:text-accent-600 font-medium"
                      >
                        {shopById.get(entry.customer_id) ?? "—"}
                      </Link>
                    </td>
                    <td className="text-navy-500 hidden px-4 py-3 sm:table-cell">
                      {entry.entry_type === "payment"
                        ? `Payment · ${entry.payment_method?.replace("_", " ") ?? "other"}`
                        : (entry.memo ?? "Adjustment")}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${entry.amount < 0 ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {entry.amount > 0 ? "+" : "−"}
                      {formatAmount(Math.abs(entry.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ShowMore
              pathname="/shop/payments"
              searchParams={params}
              current={limit}
              hasMore={hasMore}
              noun="entries"
            />
          </div>
        </section>
      )}
    </div>
  );
}

function LedgerTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-navy-500 text-xs leading-snug">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums sm:text-xl">
        Rs {formatAmount(value)}
      </p>
    </div>
  );
}
