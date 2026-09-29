"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FileText } from "lucide-react";
import { priceAndInvoiceRxAction, type RxInvoiceState } from "./actions";

/**
 * Enter an RX order's prices (per lens) and issue its invoice in one step,
 * from the RX search. The invoice posts to the shop's ledger as usual.
 */
export function RxInvoiceForm({
  orderId,
  salePrice,
  purchasePrice,
}: {
  orderId: string;
  salePrice: number;
  purchasePrice: number | null;
}) {
  const [state, formAction] = useActionState<RxInvoiceState, FormData>(
    priceAndInvoiceRxAction,
    {},
  );

  const box =
    "border-mist-300 focus:border-accent-600 w-24 rounded-md border bg-white px-2 py-1.5 text-right text-sm tabular-nums outline-none";

  return (
    <form action={formAction} className="mt-2 space-y-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap items-end justify-end gap-2">
        <label className="text-navy-500 text-left text-xs">
          Purchase
          <input
            name="purchasePrice"
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            defaultValue={purchasePrice ?? ""}
            className={`${box} mt-0.5 block`}
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
            className={`${box} mt-0.5 block`}
          />
        </label>
        <InvoiceButton />
      </div>
      <p className="text-navy-400 text-right text-xs">Per lens.</p>
      {state.error && (
        <p role="alert" className="text-right text-xs text-amber-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function InvoiceButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent-600 hover:bg-accent-700 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-60"
    >
      <FileText className="size-3.5" aria-hidden />
      {pending ? "Invoicing…" : "Generate invoice"}
    </button>
  );
}
