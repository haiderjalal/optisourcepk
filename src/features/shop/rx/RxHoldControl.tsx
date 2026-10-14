"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PauseCircle, Play, Save, X } from "lucide-react";
import { setRxHoldAction, type RxActionState } from "./actions";

/**
 * Put an RX order on hold at the lab, with the reason, or release the hold.
 *
 * The server writes the reason into the order's notes; this control only
 * collects it. A held lens cannot be marked back from the lab until released.
 */
export function RxHoldControl({
  orderId,
  onHold,
  canHold,
  compact = false,
}: {
  orderId: string;
  onHold: boolean;
  /** Not invoiced and not back from the lab, so a hold can start. */
  canHold: boolean;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [keepEditorOpen, setKeepEditorOpen] = useState(false);
  const [state, formAction] = useActionState<RxActionState, FormData>(
    setRxHoldAction,
    {},
  );
  // After a save the editor closes, until the operator opens it again.
  const savedAndClosed = state.saved && !keepEditorOpen;

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

  if (onHold) {
    return (
      <form
        action={formAction}
        onSubmit={() => setKeepEditorOpen(false)}
        className={`flex flex-wrap items-center gap-2 ${compact ? "justify-end" : ""}`}
      >
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="onHold" value="false" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
          <PauseCircle className="size-3.5" aria-hidden />
          On hold
        </span>
        <ReleaseButton />
        {feedback}
      </form>
    );
  }

  if (!canHold) return null;

  if (!editing || savedAndClosed) {
    return (
      <div className={compact ? "mt-1" : ""}>
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setKeepEditorOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50"
        >
          <PauseCircle className="size-3.5" aria-hidden />
          Put on hold
        </button>
        {feedback}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setKeepEditorOpen(false)}
      className={`flex flex-wrap items-end gap-2 ${compact ? "mt-1 justify-end" : ""}`}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="onHold" value="true" />
      <label className="text-navy-500 text-left text-xs">
        Reason for the hold
        <input
          name="reason"
          type="text"
          maxLength={200}
          required
          autoFocus
          className="focus:border-accent-600 mt-0.5 block w-64 rounded-md border border-mist-300 bg-white px-2 py-1.5 text-sm outline-none"
        />
      </label>
      <HoldSaveButton />
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-navy-400 hover:text-navy-700 rounded-md p-1.5"
        aria-label="Cancel"
      >
        <X className="size-4" aria-hidden />
      </button>
      {feedback}
    </form>
  );
}

function HoldSaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent-600 hover:bg-accent-700 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
    >
      <Save className="size-3.5" aria-hidden />
      {pending ? "Saving…" : "Save hold"}
    </button>
  );
}

function ReleaseButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50 disabled:opacity-60"
    >
      <Play className="size-3.5" aria-hidden />
      {pending ? "Releasing…" : "Release hold"}
    </button>
  );
}
