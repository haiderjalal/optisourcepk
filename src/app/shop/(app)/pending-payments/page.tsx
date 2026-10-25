import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/shop/dal";
import { listOutstanding } from "@/services/shop/ledger.service";
import {
  paymentReminderLink,
  paymentReminderMessage,
  whatsappNumber,
} from "@/features/shop/payments/reminder";
import { formatAmount } from "@/lib/format";

export const metadata: Metadata = { title: "Pending payments" };

export default async function PendingPaymentsPage() {
  await requireUser();
  const owing = await listOutstanding();
  const total = owing.reduce((sum, row) => sum + row.balance, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="eyebrow text-accent-600">Accounts</p>
        <h1 className="mt-2 text-2xl font-bold">Pending payments</h1>
        <p className="text-navy-500 mt-2 max-w-prose text-sm">
          Shops that still owe money, largest balance first. Send a reminder on
          WhatsApp from the row; the chat opens with the message ready for you
          to press send.
        </p>
      </header>

      <div className="shadow-lift mb-6 grid gap-px overflow-hidden rounded-2xl bg-mist-200 sm:grid-cols-2">
        <div className="bg-white px-5 py-4">
          <p className="text-navy-500 text-xs">Total pending</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            Rs {formatAmount(total)}
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-navy-500 text-xs">Shops owing</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{owing.length}</p>
        </div>
      </div>

      {owing.length === 0 ? (
        <p className="text-navy-500 text-sm">No shop owes money right now.</p>
      ) : (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <caption className="sr-only">Shops with a balance due</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Shop
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Owner
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Phone
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Invoiced
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Paid
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Balance due
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Reminder
                  </th>
                </tr>
              </thead>
              <tbody>
                {owing.map((row) => {
                  const number = whatsappNumber(row.phone);
                  const shopName = row.shop_name || row.customer_name;
                  return (
                    <tr
                      key={row.customer_id}
                      className="border-t border-mist-200"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/shop/customers/${row.customer_id}/statement`}
                          className="text-accent-700 font-medium hover:underline"
                        >
                          {shopName}
                        </Link>
                        {row.area && (
                          <span className="text-navy-400 block text-xs">
                            {row.area}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">{row.customer_name}</td>
                      <td className="text-navy-500 px-3 py-2.5 whitespace-nowrap">
                        {row.phone}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatAmount(row.invoiced)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatAmount(row.paid)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-700 tabular-nums">
                        {formatAmount(row.balance)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {number ? (
                          <a
                            href={paymentReminderLink(
                              number,
                              paymentReminderMessage({
                                shopName,
                                balance: row.balance,
                              }),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                          >
                            Send reminder
                          </a>
                        ) : (
                          <span className="text-xs text-amber-700">
                            No WhatsApp number
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-mist-200 font-semibold">
                  <td className="px-4 py-2.5" colSpan={5}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAmount(total)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
