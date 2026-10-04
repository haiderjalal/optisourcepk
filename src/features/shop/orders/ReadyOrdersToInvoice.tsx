"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { FileText } from "lucide-react";
import { formatAmount, formatDate } from "@/lib/format";
import type { ReadyOrdersShop } from "@/services/shop/invoice.service";
import { issueOrdersInvoiceAction, type CombineState } from "./actions";

/**
 * Saved orders not yet invoiced, grouped by shop. Tick the ones to bill and
 * "Generate invoice" puts them on one invoice — as RX does with its orders.
 */
export function ReadyOrdersToInvoice({
  shops,
  daily = false,
}: {
  shops: ReadyOrdersShop[];
  daily?: boolean;
}) {
  if (shops.length === 0) return null;

  return (
    <section className="shadow-lift mb-5 rounded-2xl bg-white p-5">
      <h2 className="text-base font-semibold">Ready to invoice</h2>
      <p className="text-navy-500 mt-1 text-xs">
        {daily ? "Saved daily orders" : "Saved orders"} not invoiced yet, by
        shop. Tick the ones to bill and generate one invoice for them. Stock
        {daily ? " and the daily register" : ""} move when the invoice is made.
      </p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {shops.map((shop) => (
          <ShopCard key={shop.customerId} shop={shop} />
        ))}
      </ul>
    </section>
  );
}

function ShopCard({ shop }: { shop: ReadyOrdersShop }) {
  const [state, formAction] = useActionState<CombineState, FormData>(
    issueOrdersInvoiceAction,
    {},
  );
  // Everything ticked to start with: billing a shop's orders together is the
  // usual case; unticking leaves an order for a later invoice.
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(shop.orders.map((o) => o.id)),
  );
  const chosen = shop.orders.filter((o) => picked.has(o.id));
  const total = chosen.reduce((sum, o) => sum + o.total, 0);

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <li className="rounded-xl border border-mist-200 p-4">
      <form action={formAction}>
        <input type="hidden" name="customerId" value={shop.customerId} />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">{shop.shopName}</span>
          <span className="text-navy-500 text-xs">
            {shop.orders.length} saved{" "}
            {shop.orders.length === 1 ? "order" : "orders"}
          </span>
        </div>

        <ul className="text-navy-700 mt-2 space-y-1 text-sm">
          {shop.orders.map((order) => (
            <li key={order.id} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                name="orderIds"
                value={order.id}
                checked={picked.has(order.id)}
                onChange={() => toggle(order.id)}
                aria-label={`Include order ${order.orderNo}`}
                className="size-4 shrink-0"
              />
              <Link
                href={`/shop/orders/${order.id}`}
                className="hover:text-accent-700 min-w-0 flex-1 truncate hover:underline"
              >
                {[
                  `Order ${order.orderNo}`,
                  order.externalRef,
                  order.isDaily ? "Daily" : null,
                  formatDate(order.createdAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Link>
              <span className="tabular-nums">{formatAmount(order.total)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <GenerateButton count={chosen.length} />
          <span className="text-sm">
            <span className="text-navy-500">Invoice total </span>
            <span className="font-semibold tabular-nums">
              Rs {formatAmount(total)}
            </span>
          </span>
        </div>
      </form>
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-amber-700">
          {state.error}
        </p>
      )}
    </li>
  );
}

function GenerateButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || count === 0}
      className="bg-accent-600 hover:bg-accent-700 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
    >
      <FileText className="size-4" aria-hidden />
      {pending
        ? "Invoicing…"
        : count === 0
          ? "Tick an order"
          : `Generate invoice (${count})`}
    </button>
  );
}
