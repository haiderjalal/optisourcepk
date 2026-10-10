import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import {
  listOrders,
  listOrdersReadyToInvoice,
} from "@/services/shop/invoice.service";
import { ReadyOrdersToInvoice } from "@/features/shop/orders/ReadyOrdersToInvoice";
import { getCustomerShopNames } from "@/services/shop/customer.service";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/features/shop/orders/StatusBadge";
import { ShopPageHeader } from "@/features/shop/layout/ShopPageHeader";
import { formatAmount, formatDate } from "@/lib/format";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteOrderAction } from "@/features/shop/orders/actions";
import { ShowMore } from "@/components/ui/show-more";
import { listLimit, type ListSearchParams } from "@/lib/list-pagination";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const VIEWS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "invoiced", label: "Invoiced" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function readView(value: ListSearchParams[string]): ViewKey {
  return value === "draft" || value === "invoiced" ? value : "all";
}

export default async function OrdersPage({
  searchParams,
}: PageProps<"/shop/orders">) {
  await requireUser();
  const params = await searchParams;
  const limit = listLimit(params.limit);
  const view = readView(params.view);
  // Drafts have no invoice number yet; invoiced ones do. "All" has no filter.
  const issued =
    view === "draft" ? false : view === "invoiced" ? true : undefined;

  // RX orders live on the RX screen.
  const [orders, ready] = await Promise.all([
    listOrders({ rx: false, issued, limit: limit + 1 }),
    listOrdersReadyToInvoice(),
  ]);
  // Drafts carry no billing snapshot yet — that is written when the invoice is
  // issued — so resolve the live customer for anything not yet invoiced.
  const shopById = await getCustomerShopNames(
    orders.map((order) => order.bill_to_customer_id),
  );
  const hasMore = orders.length > limit;
  const visibleOrders = orders.slice(0, limit);

  return (
    <div className="mx-auto max-w-5xl">
      <ShopPageHeader
        eyebrow="Trade"
        title="Orders"
        description="Save orders as they come in. Invoice a shop's saved orders together, from the list below."
        actions={
          <ButtonLink href="/shop/orders/new">
            <Plus className="size-4" aria-hidden />
            New order
          </ButtonLink>
        }
      />

      <ReadyOrdersToInvoice shops={ready} />

      <nav aria-label="Filter orders" className="mb-4">
        <ul className="inline-flex rounded-full bg-mist-200/70 p-1">
          {VIEWS.map((tab) => {
            const active = tab.key === view;
            return (
              <li key={tab.key}>
                <Link
                  href={
                    tab.key === "all"
                      ? "/shop/orders"
                      : `/shop/orders?view=${tab.key}`
                  }
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-4 text-sm font-medium transition-colors",
                    active
                      ? "text-navy-700 bg-white shadow-sm"
                      : "text-navy-500 hover:text-navy-700",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <ClipboardList className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">
            {view === "all"
              ? "No orders yet."
              : view === "draft"
                ? "No drafts waiting."
                : "Nothing invoiced yet."}
          </h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            {view === "all"
              ? "Save orders as they come in, then generate one invoice for a shop’s orders together. Stock comes off the shelf and the customer’s account updates when the invoice is made."
              : view === "draft"
                ? "Every saved order has been invoiced."
                : "Invoices appear here once they are issued."}
          </p>
          {view === "all" && (
            <ButtonLink href="/shop/orders/new" className="mt-6">
              <Plus className="size-4" aria-hidden />
              Create the first order
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Orders and invoices</caption>
            <thead>
              <tr className="text-navy-500 bg-mist-100 text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  Number
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Shop
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-medium sm:table-cell"
                >
                  Date
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Amount (Rs)
                </th>
                <th scope="col" className="w-24 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t border-mist-200 hover:bg-mist-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/shop/orders/${order.id}`}
                      className="hover:text-accent-600 font-medium"
                    >
                      {order.invoice_no
                        ? `Invoice ${order.invoice_no}`
                        : order.reserved_invoice_no
                          ? `Invoice ${order.reserved_invoice_no} · editing`
                          : `Order ${order.order_no}`}
                    </Link>
                    {order.priority === "urgent" && (
                      <span className="ml-2 text-xs font-semibold text-amber-700">
                        URGENT
                      </span>
                    )}
                  </td>
                  <td className="text-navy-600 px-4 py-3">
                    {order.bill_to_shop ??
                      shopById.get(order.bill_to_customer_id) ??
                      "—"}
                  </td>
                  <td className="text-navy-500 hidden px-4 py-3 sm:table-cell">
                    {formatDate(order.issued_at ?? order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge order={order} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {order.amount_incl_tax === null
                      ? "—"
                      : formatAmount(order.amount_incl_tax)}
                  </td>
                  <td className="px-4 py-3">
                    {/* Only a draft can be changed. Once issued the database
                        freezes it, and void is the way back. */}
                    {order.issued_at === null ? (
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/shop/orders/${order.id}/edit`}
                          className="text-navy-300 hover:text-navy-600 rounded-md p-1.5 transition-colors hover:bg-mist-100"
                          title={`Edit order ${order.order_no}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                          <span className="sr-only">
                            Edit order {order.order_no}
                          </span>
                        </Link>
                        <ConfirmButton
                          action={deleteOrderAction}
                          id={order.id}
                          idField="orderId"
                          kind="delete"
                          name={`order ${order.order_no}`}
                          question="Delete draft? (restorable for 7 days)"
                          confirmLabel="Delete"
                        />
                      </div>
                    ) : (
                      <span className="text-navy-300 block text-right text-xs">
                        issued
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ShowMore
            pathname="/shop/orders"
            searchParams={params}
            current={limit}
            hasMore={hasMore}
            noun="orders"
          />
        </div>
      )}
    </div>
  );
}
