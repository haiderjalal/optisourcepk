"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Hash, Save, X } from "lucide-react";
import { saveLabOrderNumberAction, type RxActionState } from "./actions";

/** Add or edit the reference returned by the lab, independently of invoicing. */
export function RxLabOrderNumberButton({
  orderId,
  initialValue,
  compact = false,
}: {
  orderId: string;
  initialValue: string | null;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<RxActionState, FormData>(
    saveLabOrderNumberAction,
    {},
  );
  const value = state.labOrderNo ?? initialValue ?? "";

  if (!editing) {
    return (
      <div className={compact ? "mt-1" : ""}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-accent-700 hover:bg-accent-50 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors"
        >
          <Hash className="size-3.5" aria-hidden />
          {value ? "Edit lab order no." : "Add lab order no."}
        </button>
        {state.message && (
          <p role="status" className="mt-1 text-xs text-emerald-700">
            {state.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={`flex flex-wrap items-end gap-2 ${compact ? "mt-1 justify-end" : ""}`}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <label className="text-navy-500 text-left text-xs">
        Lab order number
        <input
          name="labOrderNo"
          type="text"
          maxLength={80}
          required
          defaultValue={value}
          autoFocus
          className="focus:border-accent-600 mt-0.5 block w-36 rounded-md border border-mist-300 bg-white px-2 py-1.5 text-sm outline-none"
        />
      </label>
      <SaveButton />
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-navy-400 hover:text-navy-700 rounded-md p-1.5"
        aria-label="Cancel"
      >
        <X className="size-4" aria-hidden />
      </button>
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
      className="bg-accent-600 hover:bg-accent-700 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
    >
      <Save className="size-3.5" aria-hidden />
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
