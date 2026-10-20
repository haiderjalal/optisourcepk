"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, X } from "lucide-react";
import { removeLedgerEntryAction, type LedgerActionState } from "./actions";

/**
 * Remove a payment or adjustment from a shop's statement. The first click asks
 * for confirmation, because every balance after the entry moves with it.
 */
export function LedgerEntryRemoveButton({
  entryId,
  label,
}: {
  entryId: string;
  /** What the row says, e.g. "Payment discount", so the question names it. */
  label: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState<LedgerActionState, FormData>(
    removeLedgerEntryAction,
    {},
  );

  const feedback = (
    <>
      {state.error && (
        <p role="alert" className="mt-1 text-xs text-amber-700">
          {state.error}
        </p>
      )}
      {state.message && !state.error && (
        <p role="status" className="mt-1 text-xs text-emerald-700">
          {state.message}
        </p>
      )}
    </>
  );

  if (state.message && !state.error) return feedback;

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${label}`}
          title="Remove this entry"
          className="text-navy-400 rounded p-1 transition-colors hover:bg-mist-100 hover:text-amber-700"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
        {feedback}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="entryId" value={entryId} />
      <span className="text-navy-600 max-w-xs text-right text-xs">
        Remove {label}? Balances after it move, and it stays in Recently deleted
        for 7 days.
      </span>
      <div className="flex items-center gap-2">
        <RemoveButton />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-navy-400 hover:text-navy-700 rounded-md p-1.5"
          aria-label="Cancel"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
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
