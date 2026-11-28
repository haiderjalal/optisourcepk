"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatAmount, todayInKarachi } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/validations/shop/payment";
import {
  recordSupplierPaymentAction,
  type SupplierPaymentState,
} from "./actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending || disabled}>
      <Wallet className="size-4" aria-hidden />
      {pending ? "Recording…" : "Record payment"}
    </Button>
  );
}

/**
 * Record money sent to a supplier's account. The database refuses any amount
 * above what is owed to them.
 */
export function SupplierPaymentForm({
  supplierId,
  owed,
}: {
  supplierId: string;
  owed: number;
}) {
  const [state, formAction] = useActionState<SupplierPaymentState, FormData>(
    recordSupplierPaymentAction.bind(null, supplierId),
    {},
  );
  const [amount, setAmount] = useState("");
  const paid = Number(amount) || 0;

  if (owed <= 0) {
    return (
      <p className="text-navy-500 text-sm">
        Nothing is owed to this supplier right now.
      </p>
    );
  }

  return (
    <form action={formAction} className="shadow-lift rounded-2xl bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="amount"
          label="Amount sent (Rs)"
          required
          hint={`At most Rs ${formatAmount(owed)}`}
          errors={state.fieldErrors?.amount}
        >
          {(p) => (
            <input
              {...p}
              type="number"
              step="0.01"
              min={0.01}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>

        <Field
          name="method"
          label="Paid by"
          required
          errors={state.fieldErrors?.method}
        >
          {(p) => (
            <select {...p} defaultValue="cash">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          name="paymentDate"
          label="Date sent"
          required
          hint="Backdate it if needed."
          errors={state.fieldErrors?.paymentDate}
        >
          {(p) => <input {...p} type="date" defaultValue={todayInKarachi()} />}
        </Field>

        <Field
          name="reference"
          label="Reference"
          hint="Cheque or transaction number"
          errors={state.fieldErrors?.reference}
        >
          {(p) => <input {...p} type="text" />}
        </Field>

        <Field name="memo" label="Note" className="sm:col-span-2">
          {(p) => <input {...p} type="text" placeholder="Optional" />}
        </Field>
      </div>

      {paid > 0 && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-mist-50 p-4 text-sm">
          <div>
            <dt className="text-navy-500 text-xs">Owed now</dt>
            <dd className="font-medium tabular-nums">
              Rs {formatAmount(owed)}
            </dd>
          </div>
          <div>
            <dt className="text-navy-500 text-xs">Sending</dt>
            <dd className="font-medium tabular-nums">
              Rs {formatAmount(paid)}
            </dd>
          </div>
          <div>
            <dt className="text-navy-500 text-xs">Still owed after</dt>
            <dd className="font-semibold tabular-nums">
              Rs {formatAmount(owed - paid)}
            </dd>
          </div>
        </dl>
      )}

      {state.error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}
      {state.message && !state.error && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 text-sm text-emerald-700"
        >
          <Check className="size-4" aria-hidden />
          {state.message}
        </p>
      )}

      <div className="mt-5">
        <SubmitButton disabled={paid <= 0} />
      </div>
    </form>
  );
}
