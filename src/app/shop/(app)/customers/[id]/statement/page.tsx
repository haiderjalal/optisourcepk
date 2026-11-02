import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil, Wallet } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getCustomer } from "@/services/shop/customer.service";
import { getBalance, getStatement } from "@/services/shop/ledger.service";
import { getOrderIdsByInvoiceNo } from "@/services/shop/invoice.service";
import { LedgerEntryRemoveButton } from "@/features/shop/ledger/LedgerEntryRemoveButton";
import { ButtonLink } from "@/components/ui/button";
import { formatAmount, formatDate } from "@/lib/format";
import { inputClass } from "@/components/ui/field";
import {
  describeStatementPeriod,
  isReversedPeriod,
  readStatementDay,
  statementSlice,
  type StatementPeriod,
} from "@/features/shop/ledger/statementRange";

export const metadata: Metadata = { title: "Statement" };

export default async function StatementPage({
  params,
  searchParams,
}: PageProps<"/shop/customers/[id]/statement">) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [lines, balance] = await Promise.all([
    getStatement(id),
    getBalance(id),
  ]);
  const invoiceOrderIds = await getOrderIdsByInvoiceNo(
    lines.flatMap((line) =>
      line.invoice_no === null ? [] : [line.invoice_no],
    ),
  );
  const statementLines = lines.map((line) => ({
    ...line,
    orderId:
      line.invoice_no === null
        ? undefined
        : invoiceOrderIds.get(line.invoice_no),
  }));
  const owed = balance?.balance ?? customer.opening_balance;

  // Optional From and To days. A reversed pair is shown whole, with a note.
  const requested: StatementPeriod = {
    from: readStatementDay(
      typeof query.from === "string" ? query.from : undefined,
    ),
    to: readStatementDay(typeof query.to === "string" ? query.to : undefined),
  };
  const reversed = isReversedPeriod(requested);
  const period: StatementPeriod = reversed
    ? { from: null, to: null }
    : requested;
  const periodText = describeStatementPeriod(period);
  const slice = statementSlice(statementLines, period, owed);

  const pdfQuery = new URLSearchParams();
  if (period.from !== null) pdfQuery.set("from", period.from);
  if (period.to !== null) pdfQuery.set("to", period.to);
  pdfQuery.set("download", "");

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
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            href={`/shop/customers/${id}/statement/pdf?${pdfQuery}`}
            variant="outline"
            prefetch={false}
          >
            <Download className="size-4" aria-hidden />
            Ledger PDF
          </ButtonLink>
          <ButtonLink href={`/shop/payments?customer=${id}`}>
            <Wallet className="size-4" aria-hidden />
            Record payment
          </ButtonLink>
        </div>
      </div>

      {/* A GET form: the period lives in the URL, so back and refresh work. */}
      <form
        method="get"
        className="shadow-lift mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-500 text-xs">From</span>
          <input
            type="date"
            name="from"
            defaultValue={requested.from ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-500 text-xs">To</span>
          <input
            type="date"
            name="to"
            defaultValue={requested.to ?? ""}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="bg-navy-500 rounded-xl px-4 py-2 text-sm font-medium text-white"
        >
          Show
        </button>
        {periodText !== null && (
          <Link
            href={`/shop/customers/${id}/statement`}
            className="text-navy-500 hover:text-navy-700 text-sm font-medium"
          >
            All dates
          </Link>
        )}
      </form>

      {reversed && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset"
        >
          The From date is after the To date, so every entry is shown.
        </p>
      )}
      {periodText !== null && (
        <p className="text-navy-500 mb-5 text-sm">
          Showing {periodText}.
          {period.to !== null &&
            ` Balance at ${formatDate(period.to)}: ${formatAmount(slice.closing)}.`}{" "}
          The figures above are for the whole account.
        </p>
      )}

      <div className="shadow-lift mb-5 grid gap-px overflow-hidden rounded-2xl bg-mist-200 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Invoiced" value={balance?.invoiced ?? 0} />
        <Stat label="Paid" value={balance?.paid ?? 0} tone="good" />
        <Stat
          label="Discounts / adjustments"
          value={balance?.adjustments ?? 0}
          tone={(balance?.adjustments ?? 0) <= 0 ? "good" : "owing"}
        />
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
              <th scope="col" className="px-2 py-3 font-medium">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {slice.broughtForward !== null && (
              <tr className="border-t border-mist-200 bg-mist-100/50">
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 font-medium">
                  Balance brought forward
                </td>
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatAmount(slice.broughtForward)}
                </td>
                <td className="px-2 py-2.5" />
              </tr>
            )}
            {periodText !== null && slice.lines.length === 0 && (
              <tr className="border-t border-mist-200">
                <td
                  colSpan={6}
                  className="text-navy-500 px-4 py-6 text-center text-sm"
                >
                  No entries in this period.
                </td>
              </tr>
            )}
            {slice.lines.map((line, index) => (
              <tr
                key={line.entry_id ?? `opening-${index}`}
                className="border-t border-mist-200"
              >
                <td className="text-navy-500 px-4 py-2.5 whitespace-nowrap">
                  {formatDate(line.entry_date)}
                </td>
                <td className="px-4 py-2.5">
                  {line.invoice_no ? (
                    <div>
                      {line.orderId ? (
                        <Link
                          href={`/shop/orders/${line.orderId}`}
                          className="hover:text-accent-600 font-medium"
                        >
                          Invoice {line.invoice_no}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          Invoice {line.invoice_no}
                        </span>
                      )}
                      {line.sale_type && (
                        <span className="text-navy-600 ml-2 rounded-full bg-mist-100 px-2 py-0.5 text-[10px] font-semibold uppercase">
                          {line.sale_type}
                        </span>
                      )}
                      {line.description && (
                        <span className="text-navy-400 mt-0.5 block text-xs">
                          {line.description}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span>
                      {line.description}
                      {line.sale_type === "adjustment" && (
                        <span className="text-navy-600 ml-2 rounded-full bg-mist-100 px-2 py-0.5 text-[10px] font-semibold uppercase">
                          adjustment
                        </span>
                      )}
                    </span>
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
                <td className="px-2 py-2.5 text-right">
                  {line.removable && line.entry_id && (
                    <div className="flex items-start justify-end gap-1">
                      <Link
                        href={`/shop/payments/${line.entry_id}/edit`}
                        title="Edit this entry"
                        aria-label={`Edit ${line.description}`}
                        className="text-navy-400 hover:text-accent-700 rounded p-1 hover:bg-mist-100"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Link>
                      <LedgerEntryRemoveButton
                        entryId={line.entry_id}
                        label={line.description}
                      />
                    </div>
                  )}
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
