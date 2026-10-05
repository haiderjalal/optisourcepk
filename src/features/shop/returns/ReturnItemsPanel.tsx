"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Undo2 } from "lucide-react";
import { Field } from "@/components/ui/field";
import { describeBin, formatAmount } from "@/lib/format";
import type { OrderLine } from "@/types/database";
import { recordReturnAction, type ReturnFormState } from "./actions";

/**
 * Record items a shop sent back from this invoice. The invoice itself stays as
 * issued; the return is saved on its own, stock goes back, and the shop's
 * account is credited. Behind a details element, like Void: a deliberate
 * step, not an everyday button.
 */
export function ReturnItemsPanel({
  orderId,
  lines,
  returned,
}: {
  orderId: string;
  lines: OrderLine[];
  /** Already returned, per order line id. */
  returned: Record<string, number>;
}) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [state, formAction] = useActionState<ReturnFormState, FormData>(
    async (previous, formData) => {
      const result = await recordReturnAction(previous, formData);
      if (!result.error) {
        setQty({});
        setNote("");
      }
      return result;
    },
    {},
  );

  const left = (line: OrderLine) => line.quantity - (returned[line.id] ?? 0);
  const count = (line: OrderLine) =>
    Math.max(0, Math.min(Math.trunc(Number(qty[line.id]) || 0), left(line)));
  // Same arithmetic as the database: the line's value, discount included.
  const value = (line: OrderLine) =>
    Math.round(((line.line_total * count(line)) / line.quantity) * 100) / 100;
  const total = lines.reduce((sum, line) => sum + value(line), 0);
  const items = lines.reduce((sum, line) => sum + count(line), 0);
  const anyLeft = lines.some((line) => left(line) > 0);

  return (
    <details className="shadow-lift mb-5 rounded-2xl bg-white p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-base font-semibold">
        <Undo2 className="text-navy-500 size-4" aria-hidden />
        Return items
      </summary>

      {!anyLeft ? (
        <p className="text-navy-500 mt-3 text-sm">
          Everything on this invoice has been returned.
        </p>
      ) : (
        <form action={formAction} className="mt-4">
          <input type="hidden" name="orderId" value={orderId} />
          <p className="text-navy-500 max-w-prose text-sm">
            Enter how many of each item came back. The invoice stays as issued;
            the items go back into stock and the shop&rsquo;s account is
            credited with their value.
          </p>

          <div className="mt-3 overflow-x-auto rounded-xl border border-mist-200">
            <table className="w-full text-sm">
              <caption className="sr-only">Items to return</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Item
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Sold
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Returned
                  </th>
                  <th scope="col" className="w-28 px-3 py-2 font-medium">
                    Return now
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Credit (Rs)
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const remaining = left(line);
                  const power = describeBin(line);
                  return (
                    <tr key={line.id} className="border-t border-mist-200">
                      <td className="px-3 py-2">
                        {line.product_name}
                        {power && (
                          <span className="text-navy-500 ml-1.5 font-mono text-xs">
                            {power}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {line.quantity}
                      </td>
                      <td className="text-navy-500 px-3 py-2 text-right tabular-nums">
                        {returned[line.id] ?? 0}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          name={`qty:${line.id}`}
                          min={0}
                          max={remaining}
                          step={1}
                          inputMode="numeric"
                          disabled={remaining === 0}
                          aria-label={`Return how many of ${line.product_name}`}
                          className="focus:border-accent-600 w-20 rounded-md border border-mist-300 bg-white px-2 py-1 text-sm outline-none disabled:bg-mist-100"
                          value={qty[line.id] ?? ""}
                          onChange={(e) =>
                            setQty((q) => ({ ...q, [line.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {count(line) > 0 ? formatAmount(value(line)) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Field name="note" label="Note" className="mt-4 sm:max-w-md">
            {(p) => (
              <input
                {...p}
                type="text"
                placeholder="Why it came back — broken, wrong power…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Submit disabled={items === 0} total={total} />
            {state.message && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-emerald-700"
              >
                <Check className="size-4" aria-hidden />
                {state.message}
              </p>
            )}
            {state.error && (
              <p
                role="alert"
                className="flex items-center gap-2 text-sm text-amber-700"
              >
                <AlertCircle className="size-4" aria-hidden />
                {state.error}
              </p>
            )}
          </div>
        </form>
      )}
    </details>
  );
}

function Submit({ disabled, total }: { disabled: boolean; total: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="bg-navy-700 hover:bg-navy-600 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
    >
      <Undo2 className="size-4" aria-hidden />
      {pending ? "Recording…" : `Record return · Rs ${formatAmount(total)}`}
    </button>
  );
}
