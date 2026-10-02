import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listOrders } from "@/services/shop/invoice.service";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/features/shop/orders/StatusBadge";
import {
  deleteInvoiceAction,
  reopenInvoiceAction,
} from "@/features/shop/orders/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { formatAmount, formatDate } from "@/lib/format";
import { ShowMore } from "@/components/ui/show-more";
import { listLimit } from "@/lib/list-pagination";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({
  searchParams,
}: PageProps<"/shop/invoices">) {
  await requireUser();
  const params = await searchParams;
  const limit = listLimit(params.limit);
  const invoices = await listOrders({ issued: true, limit: limit + 1 });
  const hasMore = invoices.length > limit;
  const visibleInvoices = invoices.slice(0, limit);

  const visibleTotal = visibleInvoices
    .filter((i) => i.voided_at === null)
    .reduce((sum, i) => sum + (i.amount_incl_tax ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Trade</p>
          <h1 className="mt-2 text-2xl font-bold">Invoices</h1>
          {invoices.length > 0 && (
            <p className="text-navy-500 mt-1.5 text-sm">
              Showing {visibleInvoices.length} · Rs {formatAmount(visibleTotal)}
              shown
            </p>
          )}
        </div>
        <ButtonLink href="/shop/orders/new">
          <Plus className="size-4" aria-hidden />
          New order
        </ButtonLink>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <FileText className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">No invoices issued yet.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            Build an order, then issue it. The invoice number is assigned at
            that moment and the document becomes fixed.
          </p>
          <ButtonLink href="/shop/orders/new" className="mt-6">
            <Plus className="size-4" aria-hidden />
            Create an order
          </ButtonLink>
        </div>
      ) : (
        <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Issued invoices</caption>
            <thead>
              <tr className="text-navy-500 bg-mist-100 text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  Invoice
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Customer
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-medium sm:table-cell"
                >
                  Issued
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Amount (Rs)
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t border-mist-200 hover:bg-mist-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/shop/orders/${invoice.id}`}
                      className="hover:text-accent-600 font-medium"
                    >
                      {invoice.invoice_no}
                    </Link>
                  </td>
                  <td className="text-navy-600 px-4 py-3">
                    {invoice.bill_to_shop ?? "—"}
                  </td>
                  <td className="text-navy-500 hidden px-4 py-3 sm:table-cell">
                    {formatDate(invoice.issued_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge order={invoice} />
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium tabular-nums ${
                      invoice.voided_at ? "text-navy-300 line-through" : ""
                    }`}
                  >
                    {formatAmount(invoice.amount_incl_tax ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/shop/invoices/${invoice.id}/pdf`}
                        className="text-navy-400 hover:text-accent-600 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                      >
                        <FileText className="size-3.5" aria-hidden />
                        PDF
                      </Link>
                      {!invoice.voided_at && (
                        <ConfirmButton
                          action={reopenInvoiceAction}
                          id={invoice.id}
                          name={`invoice ${invoice.invoice_no}`}
                          idField="orderId"
                          kind="edit"
                          question="Reopen as draft?"
                          confirmLabel="Yes"
                        />
                      )}
                      <ConfirmButton
                        action={deleteInvoiceAction}
                        id={invoice.id}
                        name={`invoice ${invoice.invoice_no}`}
                        idField="orderId"
                        kind="delete"
                        question="Delete?"
                        confirmLabel="Yes"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ShowMore
            pathname="/shop/invoices"
            searchParams={params}
            current={limit}
            hasMore={hasMore}
            noun="invoices"
          />
        </div>
      )}
    </div>
  );
}
