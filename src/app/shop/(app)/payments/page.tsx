import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/shop/dal";
import { listCustomers } from "@/services/shop/customer.service";
import { listRecentPayments } from "@/services/shop/ledger.service";
import { PaymentForm } from "@/features/shop/payments/PaymentForm";
import { ButtonLink } from "@/components/ui/button";
import { formatAmount, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: PageProps<"/shop/payments">) {
  await requireUser();

  const { customer } = await searchParams;
  const preset = typeof customer === "string" ? customer : undefined;

  const [customers, recent] = await Promise.all([
    listCustomers(),
    listRecentPayments(12),
  ]);

  const shopById = new Map(customers.map((c) => [c.id, c.shop_name]));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="eyebrow text-accent-600">Accounts</p>
        <h1 className="mt-2 text-2xl font-bold">Record a payment</h1>
        <p className="text-navy-500 mt-2 max-w-prose text-sm">
          Payments go against the account rather than against one invoice —
          shops pay in round sums, whenever they pay.
        </p>
      </div>

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

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold">Recent payments</h2>
          <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">Recently recorded payments</caption>
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
                    Method
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Amount (Rs)
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((entry) => (
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
                    <td className="text-navy-500 hidden px-4 py-3 capitalize sm:table-cell">
                      {entry.payment_method?.replace("_", " ") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700 tabular-nums">
                      {formatAmount(Math.abs(entry.amount))}
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
