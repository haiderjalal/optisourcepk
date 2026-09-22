"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive } from "lucide-react";

/**
 * Archive a product or customer from a list row.
 *
 * Confirms in place rather than through `window.confirm`, which is easy to
 * dismiss by reflex and looks nothing like the rest of the application.
 */
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
    >
      {pending ? "Archiving…" : label}
    </button>
  );
}

export function ArchiveButton({
  action,
  id,
  name,
  what = "product",
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  name: string;
  what?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-navy-300 rounded-md p-1.5 transition-colors hover:bg-amber-50 hover:text-amber-700"
        title={`Archive ${name}`}
      >
        <Archive className="size-4" aria-hidden />
        <span className="sr-only">Archive {name}</span>
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="id" value={id} />
      <span className="text-navy-500 text-xs">Archive this {what}?</span>
      <Submit label="Yes" />
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
