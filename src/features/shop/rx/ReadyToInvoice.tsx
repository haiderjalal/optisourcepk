"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { FileText } from "lucide-react";
import { formatAmount, formatRxNo } from "@/lib/format";
import type { ReadyShop } from "@/services/shop/rx.service";
import { issueRxInvoiceAction, type RxActionState } from "./actions";

/**
 * RX orders back from the lab, grouped by shop. "Generate invoice" puts all
 * of a shop's ready orders on one invoice and posts it to their ledger.
 */
export function ReadyToInvoice({ shops }: { shops: ReadyShop[] }) {
  if (shops.length === 0) return null;

  return (
    <section className="shadow-lift mb-5 rounded-2xl bg-white p-5">
      <h2 className="text-base font-semibold">Ready to invoice</h2>
      <p className="text-navy-500 mt-1 text-xs">
        One invoice per shop, with every RX order that is back from the lab.
        Each lens shows the optician&rsquo;s order no. and the RX no.
      </p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {shops.map((shop) => (
          <ShopCard key={shop.customerId} shop={shop} />
        ))}
      </ul>
    </section>
  );
}

function ShopCard({ shop }: { shop: ReadyShop }) {
  const [state, formAction] = useActionState<RxActionState, FormData>(
    issueRxInvoiceAction,
    {},
  );
  const unpriced = shop.orders.filter((o) => !o.priced);

  return (
    <li className="rounded-xl border border-mist-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{shop.shopName}</span>
        <span className="text-sm tabular-nums">
          {shop.orders.length} {shop.orders.length === 1 ? "order" : "orders"} ·
          Rs {formatAmount(shop.total)}
        </span>
      </div>
      <ul className="text-navy-600 mt-2 space-y-1 text-sm">
        {shop.orders.map((order) => (
          <li key={order.id} className="flex justify-between gap-3">
            <Link
              href={`/shop/orders/${order.id}`}
              className="hover:text-accent-700 hover:underline"
            >
              {[
                order.externalRef,
                formatRxNo(order.rxNo),
                order.labOrderNo ? `Lab ${order.labOrderNo}` : null,
                order.patientName,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Link>
            <span
              className={`tabular-nums ${order.priced ? "" : "text-amber-700"}`}
            >
              {order.priced ? formatAmount(order.total) : "no price"}
            </span>
          </li>
        ))}
      </ul>
      <form
        action={formAction}
        className="mt-3 flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="customerId" value={shop.customerId} />
        <GenerateButton disabled={unpriced.length > 0} />
        {unpriced.length > 0 && (
          <span className="text-xs text-amber-700">
            Enter the sale price for{" "}
            {unpriced.map((o) => formatRxNo(o.rxNo)).join(", ")} first.
          </span>
        )}
      </form>
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-amber-700">
          {state.error}
        </p>
      )}
    </li>
  );
}

function GenerateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="bg-accent-600 hover:bg-accent-700 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
    >
      <FileText className="size-4" aria-hidden />
      {pending ? "Invoicing…" : "Generate invoice"}
    </button>
  );
}
