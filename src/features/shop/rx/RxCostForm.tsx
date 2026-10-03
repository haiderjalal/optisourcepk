"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { setRxCostAction, type RxActionState } from "./actions";

/**
 * The lab's price for an RX order that is already invoiced. Changing it moves
 * only our cost and profit; the customer's invoice stays as issued.
 */
export function RxCostForm({
  orderId,
  unitCost,
}: {
  orderId: string;
  unitCost: number | null;
}) {
  const [state, formAction] = useActionState<RxActionState, FormData>(
    setRxCostAction,
    {},
  );

  return (
    <form
      action={formAction}
      className="mt-4 flex flex-wrap items-end gap-3 border-t border-mist-200 pt-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <label className="text-navy-600 text-sm">
        <span className="block font-medium">Purchase price (per lens)</span>
        <input
          name="unitCost"
          type="number"
          step="0.01"
          min={0}
          inputMode="decimal"
          defaultValue={unitCost ?? ""}
          className="focus:border-accent-600 mt-1 block w-32 rounded-lg border border-mist-300 bg-white px-3 py-2 text-right text-sm tabular-nums outline-none"
        />
      </label>
      <SaveButton />
      <p className="text-navy-400 w-full text-xs">
        The lab&rsquo;s price. Changing it updates your cost and profit only —
        the customer&rsquo;s invoice stays as issued.
      </p>
      {state.error && (
        <p role="alert" className="w-full text-xs text-amber-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="w-full text-xs text-emerald-700">
          {state.message}
        </p>
      )}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-navy-700 inline-flex items-center gap-1.5 rounded-lg border border-mist-300 bg-white px-3 py-2 text-sm font-medium transition-colors hover:bg-mist-100 disabled:opacity-60"
    >
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
