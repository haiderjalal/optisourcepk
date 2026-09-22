import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listOrders } from "@/services/shop/invoice.service";
import { listCustomers } from "@/services/shop/customer.service";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/features/shop/orders/StatusBadge";
import { formatAmount, formatDate } from "@/lib/format";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteOrderAction } from "@/features/shop/orders/actions";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  await requireUser();
  const [orders, customers] = await Promise.all([
    listOrders(),
    listCustomers(),
  ]);
  // Drafts have no billing snapshot yet — that is written when the invoice is
  // issued — so resolve the live customer for anything not yet invoiced.
  const shopById = new Map(customers.map((c) => [c.id, c.shop_name]));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Trade</p>
          <h1 className="mt-2 text-2xl font-bold">Orders</h1>
        </div>
        <ButtonLink href="/shop/orders/new">
          <Plus className="size-4" aria-hidden />
          New order
        </ButtonLink>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <ClipboardList className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">No orders yet.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            Build an order line by line, then issue the invoice. Stock comes off
            the shelf and the customer&rsquo;s account updates automatically.
          </p>
          <ButtonLink href="/shop/orders/new" className="mt-6">
            <Plus className="size-4" aria-hidden />
            Create the first order
          </ButtonLink>
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
                  Customer
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
                <th scope="col" className="w-32 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
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
                          question="Delete this draft?"
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
        </div>
      )}
    </div>
  );
}
