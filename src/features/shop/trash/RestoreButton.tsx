"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RotateCcw } from "lucide-react";
import { restoreAction, type RestoreState } from "./actions";

/** Restore one deleted item, with its error shown in place. */
export function RestoreButton({
  id,
  source,
  label,
}: {
  id: string;
  source: "trash" | "expense";
  label: string;
}) {
  const [state, formAction] = useActionState<RestoreState, FormData>(
    restoreAction,
    {},
  );

  return (
    <form action={formAction} className="text-right">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="source" value={source} />
      <Submit label={label} />
      {state.error && (
        <p role="alert" className="mt-1 max-w-64 text-xs text-amber-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-navy-700 inline-flex items-center gap-1.5 rounded-lg border border-mist-300 bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-mist-100 disabled:opacity-60"
    >
      <RotateCcw className="size-3.5" aria-hidden />
      {pending ? "Restoring…" : "Restore"}
      <span className="sr-only"> {label}</span>
    </button>
  );
}
