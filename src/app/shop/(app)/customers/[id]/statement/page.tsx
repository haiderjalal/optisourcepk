import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getCustomer } from "@/services/shop/customer.service";
import { getBalance, getStatement } from "@/services/shop/ledger.service";
import { ButtonLink } from "@/components/ui/button";
import { formatAmount, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Statement" };

export default async function StatementPage({
  params,
}: PageProps<"/shop/customers/[id]/statement">) {
  await requireUser();
  const { id } = await params;

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [lines, balance] = await Promise.all([
    getStatement(id),
    getBalance(id),
  ]);
  const owed = balance?.balance ?? customer.opening_balance;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/shop/customers/${id}`}
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {customer.shop_name}
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Statement</p>
          <h1 className="mt-2 text-2xl font-bold">{customer.shop_name}</h1>
          <p className="text-navy-500 mt-1 text-sm">
            {customer.customer_name} · {customer.area}
          </p>
        </div>
        <ButtonLink href={`/shop/payments?customer=${id}`}>
          <Wallet className="size-4" aria-hidden />
          Record payment
        </ButtonLink>
      </div>

      <div className="shadow-lift mb-5 grid gap-px overflow-hidden rounded-2xl bg-mist-200 sm:grid-cols-3">
        <Stat label="Invoiced" value={balance?.invoiced ?? 0} />
        <Stat label="Paid" value={balance?.paid ?? 0} tone="good" />
        <Stat
          label="Balance"
          value={owed}
          tone={owed > 0 ? "owing" : owed < 0 ? "good" : undefined}
          strong
        />
      </div>

      <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Dated statement with a running balance
          </caption>
          <thead>
            <tr className="text-navy-500 bg-mist-100 text-left">
              <th scope="col" className="px-4 py-3 font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Detail
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Debit
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Credit
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={line.entry_id ?? `opening-${index}`}
                className="border-t border-mist-200"
              >
                <td className="text-navy-500 px-4 py-2.5 whitespace-nowrap">
                  {formatDate(line.entry_date)}
                </td>
                <td className="px-4 py-2.5">
                  {line.invoice_no ? (
                    <span className="font-medium">
                      Invoice {line.invoice_no}
                    </span>
                  ) : (
                    line.description
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {line.debit === null ? "" : formatAmount(line.debit)}
                </td>
                <td className="px-4 py-2.5 text-right text-emerald-700 tabular-nums">
                  {line.credit === null ? "" : formatAmount(line.credit)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatAmount(line.running_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-navy-400 mt-3 text-xs">
        A positive balance is what the shop owes. The running balance is summed
        from these entries and never stored separately, so this column and the
        figure above cannot disagree.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone?: "good" | "owing";
  strong?: boolean;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-navy-500 text-xs">{label}</p>
      <p
        className={`mt-1 tabular-nums ${
          strong ? "text-2xl font-bold" : "text-xl font-semibold"
        } ${
          tone === "owing"
            ? "text-amber-700"
            : tone === "good"
              ? "text-emerald-700"
              : ""
        }`}
      >
        Rs {formatAmount(value)}
      </p>
    </div>
  );
}
