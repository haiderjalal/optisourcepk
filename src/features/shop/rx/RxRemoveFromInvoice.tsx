"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { MinusCircle, X } from "lucide-react";
import { removeRxFromInvoiceAction, type RxActionState } from "./actions";

/**
 * Take a duplicate RX order off its shop's combined invoice. The invoice total
 * is worked out again and the order goes to Recently deleted, so the first
 * click asks for confirmation and says what will change.
 */
export function RxRemoveFromInvoice({
  orderId,
  label,
  compact = false,
}: {
  orderId: string;
  /** The RX number as printed, e.g. "RX-0317". */
  label: string;
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState<RxActionState, FormData>(
    removeRxFromInvoiceAction,
    {},
  );

  const feedback = (
    <>
      {state.error && (
        <p role="alert" className="w-full text-xs text-amber-700">
          {state.error}
        </p>
      )}
      {state.message && !state.error && (
        <p role="status" className="w-full text-xs text-emerald-700">
          {state.message}
        </p>
      )}
    </>
  );

  if (state.message && !state.error) {
    return <div className={compact ? "mt-1" : ""}>{feedback}</div>;
  }

  if (!confirming) {
    return (
      <div className={compact ? "mt-1" : ""}>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50"
        >
          <MinusCircle className="size-3.5" aria-hidden />
          Remove from invoice
        </button>
        {feedback}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={`flex flex-wrap items-center justify-end gap-2 ${compact ? "mt-1" : ""}`}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <span className="text-navy-600 max-w-xs text-left text-xs">
        Take {label} off its invoice? The invoice total is recalculated, and{" "}
        {label} goes to Recently deleted.
      </span>
      <RemoveButton />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-navy-400 hover:text-navy-700 rounded-md p-1.5"
        aria-label="Cancel"
      >
        <X className="size-4" aria-hidden />
      </button>
      {feedback}
    </form>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-60"
    >
      {pending ? "Removing…" : "Yes, remove"}
    </button>
  );
}
