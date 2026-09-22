"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Ban, ReceiptText, Send, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatAmount } from "@/lib/format";
import type { Order } from "@/types/database";
import {
  issueInvoiceAction,
  markDeliveredAction,
  markDispatchedAction,
  voidInvoiceAction,
  type IssueState,
} from "./actions";

function Pending({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? busy : label}</>;
}

/**
 * Issue the invoice.
 *
 * Freight and tax are entered here rather than on the order, because they are
 * decided at the moment of invoicing. Everything else — line totals, discount,
 * the net and gross — is computed by the database from the stored lines.
 */
export function IssuePanel({
  order,
  subtotal,
}: {
  order: Order;
  subtotal: number;
}) {
  const [state, formAction] = useActionState<IssueState, FormData>(
    issueInvoiceAction,
    {},
  );
  const [freight, setFreight] = useState("0");
  const [gst, setGst] = useState("0");
  const [extra, setExtra] = useState("0");

  const net = subtotal + (Number(freight) || 0);
  const gstAmount = Math.round(((net * (Number(gst) || 0)) / 100) * 100) / 100;
  const extraAmount =
    Math.round(((net * (Number(extra) || 0)) / 100) * 100) / 100;

  return (
    <form action={formAction} className="shadow-lift rounded-2xl bg-white p-5">
      <input type="hidden" name="orderId" value={order.id} />

      <h2 className="text-base font-semibold">Issue invoice</h2>
      <p className="text-navy-500 mt-1 text-sm">
        This takes the stock off the shelf, assigns the invoice number and posts
        the amount to the customer&rsquo;s account. It cannot be edited
        afterwards — only voided.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field name="freight" label="Freight (Rs)">
          {(p) => (
            <input
              {...p}
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
            />
          )}
        </Field>
        <Field name="gstRate" label="GST %">
          {(p) => (
            <input
              {...p}
              type="number"
              step="0.01"
              min={0}
              max={100}
              inputMode="decimal"
              value={gst}
              onChange={(e) => setGst(e.target.value)}
            />
          )}
        </Field>
        <Field name="additionalTaxRate" label="Additional tax %">
          {(p) => (
            <input
              {...p}
              type="number"
              step="0.01"
              min={0}
              max={100}
              inputMode="decimal"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          )}
        </Field>
      </div>

      <dl className="mt-4 space-y-1.5 rounded-lg bg-mist-50 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-navy-500">Lines</dt>
          <dd className="tabular-nums">{formatAmount(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-navy-500">Net</dt>
          <dd className="tabular-nums">{formatAmount(net)}</dd>
        </div>
        <div className="flex justify-between border-t border-mist-200 pt-1.5 font-semibold">
          <dt>Amount (incl. tax)</dt>
          <dd className="tabular-nums">
            Rs {formatAmount(net + gstAmount + extraAmount)}
          </dd>
        </div>
      </dl>

      {state.error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-4 w-full">
        <ReceiptText className="size-4" aria-hidden />
        <Pending label="Issue invoice" busy="Issuing…" />
      </Button>
    </form>
  );
}

export function DispatchPanel({ order }: { order: Order }) {
  if (order.status === "delivered") {
    return null;
  }

  if (order.status === "dispatched") {
    return (
      <form
        action={markDeliveredAction}
        className="shadow-lift rounded-2xl bg-white p-5"
      >
        <input type="hidden" name="orderId" value={order.id} />
        <h2 className="text-base font-semibold">Mark delivered</h2>
        <p className="text-navy-500 mt-1 text-sm">
          Record who delivered it and when.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="deliveredBy" label="Delivered by">
            {(p) => <input {...p} type="text" placeholder="Rider name" />}
          </Field>
          <Field name="note" label="Note">
            {(p) => <input {...p} type="text" placeholder="Optional" />}
          </Field>
        </div>
        <Button type="submit" variant="navy" className="mt-4">
          <Truck className="size-4" aria-hidden />
          <Pending label="Mark delivered" busy="Saving…" />
        </Button>
      </form>
    );
  }

  return (
    <form
      action={markDispatchedAction}
      className="shadow-lift rounded-2xl bg-white p-5"
    >
      <input type="hidden" name="orderId" value={order.id} />
      <h2 className="text-base font-semibold">Dispatch</h2>
      <p className="text-navy-500 mt-1 text-sm">
        Send it out with a courier and a tracking number.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field name="courierName" label="Courier">
          {(p) => (
            <input
              {...p}
              type="text"
              defaultValue={order.courier_name ?? ""}
              placeholder="TCS, Leopards, own rider"
            />
          )}
        </Field>
        <Field name="trackingNo" label="Tracking no.">
          {(p) => (
            <input {...p} type="text" defaultValue={order.tracking_no ?? ""} />
          )}
        </Field>
      </div>
      <Button type="submit" variant="navy" className="mt-4">
        <Send className="size-4" aria-hidden />
        <Pending label="Mark dispatched" busy="Saving…" />
      </Button>
    </form>
  );
}

/**
 * Void.
 *
 * Behind a details element on purpose: it returns stock and reverses the
 * ledger, so it should take a deliberate click rather than sit next to the
 * everyday buttons.
 */
export function VoidPanel({ order }: { order: Order }) {
  return (
    <details className="rounded-2xl border border-dashed border-mist-200 p-5">
      <summary className="text-navy-500 cursor-pointer text-sm font-medium">
        Void this invoice
      </summary>
      <form action={voidInvoiceAction} className="mt-4">
        <input type="hidden" name="orderId" value={order.id} />
        <p className="text-navy-500 max-w-prose text-sm">
          Returns the stock to its bins and posts a reversing entry to the
          customer&rsquo;s account. The invoice stays on record, marked void —
          nothing is deleted.
        </p>
        <Field name="reason" label="Reason" className="mt-3 max-w-sm">
          {(p) => (
            <input {...p} type="text" placeholder="Why is it being voided?" />
          )}
        </Field>
        <button
          type="submit"
          className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-amber-700 ring-1 ring-amber-300 transition-colors ring-inset hover:bg-amber-50"
        >
          <Ban className="size-4" aria-hidden />
          <Pending label="Void invoice" busy="Voiding…" />
        </button>
      </form>
    </details>
  );
}
