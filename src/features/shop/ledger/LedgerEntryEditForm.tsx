"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PAYMENT_METHODS } from "@/lib/validations/shop/payment";
import { formatDate } from "@/lib/format";
import { updateLedgerEntryAction, type LedgerActionState } from "./actions";

/** A saved payment or adjustment, as the edit page hands it to the form. */
export interface LedgerEntryDraft {
  id: string;
  kind: "payment" | "adjustment";
  customerName: string;
  /** The business date. It is shown, not edited: see migration 0047. */
  entryDate: string;
  /** The amount as it was recorded, without its sign. */
  amount: number;
  method: string | null;
  reference: string | null;
  memo: string | null;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function LedgerEntryEditForm({ entry }: { entry: LedgerEntryDraft }) {
  const [state, formAction] = useActionState<LedgerActionState, FormData>(
    updateLedgerEntryAction,
    {},
  );

  // Controlled so a failed save does not wipe what was typed: React resets
  // uncontrolled fields once a form action finishes.
  const [amount, setAmount] = useState(String(entry.amount));
  const [method, setMethod] = useState(entry.method ?? "cash");
  const [reference, setReference] = useState(entry.reference ?? "");
  const [memo, setMemo] = useState(entry.memo ?? "");

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="entryId" value={entry.id} />

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <p className="text-navy-500 text-sm">
          {entry.customerName} · {formatDate(entry.entryDate)} ·{" "}
          {entry.kind === "payment" ? "Payment" : "Adjustment"}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="amount" label="Amount (Rs)" required>
            {(p) => (
              <input
                {...p}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </Field>

          {entry.kind === "payment" && (
            <Field name="method" label="How it was paid" required>
              {(p) => (
                <select
                  {...p}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          <Field name="reference" label="Reference">
            {(p) => (
              <input
                {...p}
                type="text"
                placeholder="Cheque number, bank reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            )}
          </Field>

          <Field name="memo" label="Note">
            {(p) => (
              <input
                {...p}
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            )}
          </Field>
        </div>

        <p className="text-navy-400 mt-4 text-xs">
          The date and the shop cannot be changed here. For a wrong date, remove
          the entry and record it again.
        </p>
      </section>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton />
        <Link
          href="/shop/payments"
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
