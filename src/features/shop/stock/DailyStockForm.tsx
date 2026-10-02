"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { todayInKarachi } from "@/lib/format";
import type { DailyStockEntry, Product } from "@/types/database";
import { saveDailyStockAction, type DailyStockState } from "./actions";

type DailyProduct = Pick<Product, "id" | "name" | "unit">;

export function DailyStockForm({
  products,
  history,
}: {
  products: DailyProduct[];
  history: DailyStockEntry[];
}) {
  const [state, formAction] = useActionState<DailyStockState, FormData>(
    saveDailyStockAction,
    {},
  );
  const [productId, setProductId] = useState("");
  const [entryDate, setEntryDate] = useState(todayInKarachi);
  const [opening, setOpening] = useState("0");
  const [received, setReceived] = useState("0");
  const [outgoing, setOutgoing] = useState("0");
  const [note, setNote] = useState("");

  const product = products.find((item) => item.id === productId);
  const closing =
    (Number(opening) || 0) + (Number(received) || 0) - (Number(outgoing) || 0);

  function loadEntry(nextProductId: string, nextDate: string) {
    const exact = history.find(
      (row) => row.product_id === nextProductId && row.entry_date === nextDate,
    );
    const previous = history.find(
      (row) => row.product_id === nextProductId && row.entry_date < nextDate,
    );

    setOpening(String(exact?.opening_qty ?? previous?.closing_qty ?? 0));
    setReceived(String(exact?.received_qty ?? 0));
    setOutgoing(String(exact?.outgoing_qty ?? 0));
    setNote(exact?.note ?? "");
  }

  return (
    <form action={formAction} className="shadow-lift rounded-2xl bg-white p-5">
      <div>
        <h2 className="text-base font-semibold">Enter daily stock</h2>
        <p className="text-navy-500 mt-1 text-sm">
          One row per item and date. Saving it again corrects that day without
          removing older history.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          name="productId"
          label="Item"
          required
          errors={state.fieldErrors?.productId}
        >
          {(props) => (
            <select
              {...props}
              value={productId}
              onChange={(event) => {
                const id = event.target.value;
                setProductId(id);
                loadEntry(id, entryDate);
              }}
            >
              <option value="">Select an item…</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          name="entryDate"
          label="Date"
          required
          errors={state.fieldErrors?.entryDate}
        >
          {(props) => (
            <input
              {...props}
              type="date"
              value={entryDate}
              onChange={(event) => {
                const date = event.target.value;
                setEntryDate(date);
                loadEntry(productId, date);
              }}
            />
          )}
        </Field>

        <Field
          name="openingQty"
          label="Opening quantity"
          required
          hint="Morning count"
          errors={state.fieldErrors?.openingQty}
        >
          {(props) => (
            <input
              {...props}
              type="number"
              step="1"
              min={0}
              inputMode="numeric"
              value={opening}
              onChange={(event) => setOpening(event.target.value)}
            />
          )}
        </Field>

        <Field
          name="receivedQty"
          label="Incoming quantity"
          required
          hint="Received during the day"
          errors={state.fieldErrors?.receivedQty}
        >
          {(props) => (
            <input
              {...props}
              type="number"
              step="1"
              min={0}
              inputMode="numeric"
              value={received}
              onChange={(event) => setReceived(event.target.value)}
            />
          )}
        </Field>

        <Field
          name="outgoingQty"
          label="Outgoing quantity"
          required
          hint="Sold or sent out during the day"
          errors={state.fieldErrors?.outgoingQty}
        >
          {(props) => (
            <input
              {...props}
              type="number"
              step="1"
              min={0}
              inputMode="numeric"
              value={outgoing}
              onChange={(event) => setOutgoing(event.target.value)}
            />
          )}
        </Field>

        <Field
          name="note"
          label="Note"
          hint="Optional supplier, customer or reference"
          errors={state.fieldErrors?.note}
        >
          {(props) => (
            <input
              {...props}
              type="text"
              maxLength={400}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mist-50 px-4 py-3">
        <p className="text-sm">
          Closing stock:{" "}
          <span
            className={`text-lg font-semibold tabular-nums ${closing < 0 ? "text-amber-700" : ""}`}
          >
            {closing} {product?.unit ?? ""}
          </span>
        </p>
        <Submit disabled={!productId || closing < 0} />
      </div>

      {state.message && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 text-sm text-emerald-700"
        >
          <Check className="size-4" aria-hidden />
          {state.message}
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-amber-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : "Save daily stock"}
    </Button>
  );
}
