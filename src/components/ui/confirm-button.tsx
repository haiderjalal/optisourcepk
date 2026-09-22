"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, Trash2 } from "lucide-react";

/**
 * A destructive row action that confirms in place.
 *
 * Not `window.confirm`, which is dismissed by reflex and looks nothing like
 * the rest of the application. The confirmation replaces the button, so the
 * second click is deliberate and lands somewhere different from the first.
 */

const ICONS = { archive: Archive, delete: Trash2 } as const;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

export function ConfirmButton({
  action,
  id,
  name,
  idField = "id",
  kind = "archive",
  question,
  confirmLabel = "Yes",
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  /** Used in the accessible label, so it says which row is being acted on. */
  name: string;
  idField?: string;
  kind?: keyof typeof ICONS;
  question: string;
  confirmLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const Icon = ICONS[kind];
  const verb = kind === "delete" ? "Delete" : "Archive";

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-navy-300 rounded-md p-1.5 transition-colors hover:bg-amber-50 hover:text-amber-700"
        title={`${verb} ${name}`}
      >
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">
          {verb} {name}
        </span>
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name={idField} value={id} />
      <span className="text-navy-500 text-xs">{question}</span>
      <Submit label={confirmLabel} />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-navy-500 hover:text-navy-700 rounded-md px-2 py-1 text-xs font-medium"
      >
        No
      </button>
    </form>
  );
}
