"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FileText, Save } from "lucide-react";
import {
  issueRxInvoiceAction,
  priceRxAction,
  type RxActionState,
} from "./actions";

/**
 * Enter an RX order's prices (per lens) from the RX search. Saving marks it
 * back from the lab, ready for the shop's combined invoice.
 */
export function RxPriceForm({
  orderId,
  salePrice,
  purchasePrice,
  labOrderNo,
  customerId,
  ready,
}: {
  orderId: string;
  salePrice: number;
  purchasePrice: number | null;
  labOrderNo: string | null;
  customerId: string;
  ready: boolean;
}) {
  const [state, formAction] = useActionState<RxActionState, FormData>(
    priceRxAction,
    {},
  );
  const [invoiceState, invoiceAction] = useActionState<RxActionState, FormData>(
    issueRxInvoiceAction,
    {},
  );

  const box =
    "border-mist-300 focus:border-accent-600 rounded-md border bg-white px-2 py-1.5 text-sm outline-none";

  const canInvoice = (ready && salePrice > 0) || state.message !== undefined;

  return (
    <div className="mt-2 space-y-2">
      <form action={formAction} className="space-y-1.5">
        <input type="hidden" name="orderId" value={orderId} />
        <div className="flex flex-wrap items-end justify-end gap-2">
          <label className="text-navy-500 text-left text-xs">
            Lab order no.
            <input
              name="labOrderNo"
              type="text"
              maxLength={80}
              defaultValue={labOrderNo ?? ""}
              className={`${box} mt-0.5 block w-32`}
            />
          </label>
          <label className="text-navy-500 text-left text-xs">
            Purchase
            <input
              name="purchasePrice"
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              defaultValue={purchasePrice ?? ""}
              className={`${box} mt-0.5 block w-24 text-right tabular-nums`}
            />
          </label>
          <label className="text-navy-500 text-left text-xs">
            Sale
            <input
              name="salePrice"
              type="number"
              step="0.01"
              min={0.01}
              inputMode="decimal"
              required
              defaultValue={salePrice > 0 ? salePrice : ""}
              className={`${box} mt-0.5 block w-24 text-right tabular-nums`}
            />
          </label>
          <SaveButton />
        </div>
        <p className="text-navy-400 text-right text-xs">
          Prices are per lens. Lab order number is optional.
        </p>
        {state.error && (
          <p role="alert" className="text-right text-xs text-amber-700">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-right text-xs text-emerald-700">
            {state.message}
          </p>
        )}
      </form>

      {canInvoice && customerId && (
        <form
          action={invoiceAction}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <input type="hidden" name="customerId" value={customerId} />
          <GenerateInvoiceButton />
          {invoiceState.error && (
            <p
              role="alert"
              className="w-full text-right text-xs text-amber-700"
            >
              {invoiceState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-navy-700 inline-flex items-center gap-1.5 rounded-lg border border-mist-300 bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-mist-100 disabled:opacity-60"
    >
      <Save className="size-3.5" aria-hidden />
      {pending ? "Saving…" : "Save prices here"}
    </button>
  );
}

function GenerateInvoiceButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent-600 hover:bg-accent-700 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-60"
    >
      <FileText className="size-3.5" aria-hidden />
      {pending ? "Generating…" : "Generate invoice"}
    </button>
  );
}
