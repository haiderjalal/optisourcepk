"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { setPurchaseCostAction, type CostState } from "./actions";

/** One purchase line's cost, editable in place. */
export function PurchaseCostCell({
  lineId,
  purchaseId,
  unitCost,
  label,
}: {
  lineId: string;
  purchaseId: string;
  unitCost: number;
  /** For screen readers: which line this cost belongs to. */
  label: string;
}) {
  const [state, formAction] = useActionState<CostState, FormData>(
    setPurchaseCostAction,
    {},
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center justify-end gap-1.5"
    >
      <input type="hidden" name="lineId" value={lineId} />
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <input
        name="unitCost"
        type="number"
        step="0.01"
        min={0}
        inputMode="decimal"
        required
        defaultValue={unitCost}
        aria-label={`Cost for ${label}`}
        aria-invalid={state.error ? true : undefined}
        className="focus:border-accent-600 w-24 rounded-md border border-mist-300 bg-white px-2 py-1 text-right text-sm tabular-nums outline-none aria-[invalid=true]:border-amber-400"
      />
      <SaveButton saved={Boolean(state.saved)} />
      {state.error && (
        <p
          role="alert"
          className="w-full basis-full text-right text-xs text-amber-700"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}

function SaveButton({ saved }: { saved: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-navy-600 rounded-md border border-mist-300 bg-white px-2 py-1 text-xs font-medium transition-colors hover:bg-mist-100 disabled:opacity-60"
    >
      {pending ? (
        "…"
      ) : saved ? (
        <Check className="size-3.5 text-emerald-600" aria-label="Saved" />
      ) : (
        "Save"
      )}
    </button>
  );
}
