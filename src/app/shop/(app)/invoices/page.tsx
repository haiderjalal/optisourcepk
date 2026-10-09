import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listOrders } from "@/services/shop/invoice.service";
import { listCustomers } from "@/services/shop/customer.service";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { StatusBadge } from "@/features/shop/orders/StatusBadge";
import {
  deleteInvoiceAction,
  reopenInvoiceAction,
} from "@/features/shop/orders/actions";
import { ShopDocumentsList } from "@/features/shop/invoice/ShopDocumentsList";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { formatAmount, formatDate } from "@/lib/format";
import { ShowMore } from "@/components/ui/show-more";
import { listLimit } from "@/lib/list-pagination";

export const metadata: Metadata = { title: "Invoices" };

/** Shops one search can list. Past this, the search asks for more of the name. */
const MATCHED_SHOP_LIMIT = 50;

export default async function InvoicesPage({
  searchParams,
}: PageProps<"/shop/invoices">) {
  await requireUser();
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const limit = listLimit(params.limit);

  // A search finds shops by name, then lists every invoice those shops hold,
  // across all dates — the same set their combined PDF is built from.
  const shops = search
    ? await listCustomers(search, MATCHED_SHOP_LIMIT + 1)
    : [];
  const tooManyShops = shops.length > MATCHED_SHOP_LIMIT;
  const matchedShops = shops.slice(0, MATCHED_SHOP_LIMIT);

  const invoices = tooManyShops
    ? []
    : await listOrders({
        issued: true,
        customerIds: search ? matchedShops.map((shop) => shop.id) : undefined,
        limit: limit + 1,
      });
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

      {/* A GET form, as on the customers page: the search lives in the URL, so
          a result is shareable and the back button behaves. */}
      <form className="mb-5 flex gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-navy-300 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Shop or owner name"
            aria-label="Search invoices by shop or owner name"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button
          type="submit"
          className="text-navy-600 rounded-lg border border-mist-300 bg-white px-4 text-sm font-medium transition-colors hover:bg-mist-100"
        >
          Search
        </button>
        {search && (
          <Link
            href="/shop/invoices"
            className="text-navy-500 hover:text-navy-700 inline-flex items-center rounded-lg px-3 text-sm font-medium"
          >
            Clear
          </Link>
        )}
      </form>

      {tooManyShops && (
        <p className="text-navy-500 mb-5 text-sm">
          More than {MATCHED_SHOP_LIMIT} shops match. Type more of the name to
          narrow it down.
        </p>
      )}

      {search && !tooManyShops && matchedShops.length > 0 && (
        <ShopDocumentsList shops={matchedShops} />
      )}

      {!tooManyShops && invoices.length === 0 && (
        <NoInvoices search={search} shopCount={matchedShops.length} />
      )}

      {!tooManyShops && invoices.length > 0 && (
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
                          question="Edit this invoice? It keeps its number."
                          confirmLabel="Yes"
                        />
                      )}
                      <ConfirmButton
                        action={deleteInvoiceAction}
                        id={invoice.id}
                        name={`invoice ${invoice.invoice_no}`}
                        idField="orderId"
                        kind="delete"
                        question="Delete? (restorable for 7 days)"
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

function NoInvoices({
  search,
  shopCount,
}: {
  search: string;
  shopCount: number;
}) {
  if (search && shopCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
        <Search className="text-navy-300 mx-auto size-8" aria-hidden />
        <h2 className="mt-4 font-semibold">
          No shop or owner matches &ldquo;{search}&rdquo;.
        </h2>
        <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
          Try a shorter part of the shop or owner name.
        </p>
      </div>
    );
  }

  if (search) {
    return (
      <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
        <FileText className="text-navy-300 mx-auto size-8" aria-hidden />
        <h2 className="mt-4 font-semibold">
          No invoices issued to these shops yet.
        </h2>
        <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
          Invoices appear here once they are issued.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
      <FileText className="text-navy-300 mx-auto size-8" aria-hidden />
      <h2 className="mt-4 font-semibold">No invoices issued yet.</h2>
      <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
        Build an order, then issue it. The invoice number is assigned at that
        moment and the document becomes fixed.
      </p>
      <ButtonLink href="/shop/orders/new" className="mt-6">
        <Plus className="size-4" aria-hidden />
        Create an order
      </ButtonLink>
    </div>
  );
}
