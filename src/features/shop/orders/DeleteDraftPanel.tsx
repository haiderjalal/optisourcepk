"use client";

import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import type { Order } from "@/types/database";
import { deleteOrderAction } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-amber-700 ring-1 ring-amber-300 transition-colors ring-inset hover:bg-amber-50 disabled:opacity-60"
      disabled={pending}
    >
      <Trash2 className="size-4" aria-hidden />
      {pending ? "Deleting…" : "Delete draft"}
    </button>
  );
}

/**
 * Delete an unissued order.
 *
 * Behind a details element, like void: it removes the order outright, so it
 * should take a deliberate click rather than sit beside the everyday buttons.
 * Only ever shown on a draft — once issued, void is the way back.
 */
export function DeleteDraftPanel({ order }: { order: Order }) {
  if (order.issued_at !== null) return null;

  return (
    <details className="rounded-2xl border border-dashed border-mist-200 p-5">
      <summary className="text-navy-500 cursor-pointer text-sm font-medium">
        Delete this draft
      </summary>
      <form action={deleteOrderAction} className="mt-4">
        <input type="hidden" name="orderId" value={order.id} />
        <p className="text-navy-500 max-w-prose text-sm">
          Removes order {order.order_no} and its lines for good. Nothing has
          been invoiced yet, so no stock and no customer balance are affected.
        </p>
        <Submit />
      </form>
    </details>
  );
}
