"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PAYMENT_METHODS } from "@/lib/validations/shop/payment";
import { formatAmount, todayInKarachi } from "@/lib/format";
import type { CustomerWithBalance } from "@/services/shop/customer.service";
import {
  recordPaymentAction,
  type PaymentFormState,
} from "@/features/shop/orders/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Wallet className="size-4" aria-hidden />
      {pending ? "Recording…" : "Record payment"}
    </Button>
  );
}

/**
 * Record money received against a customer's account.
 *
 * Shows the balance before and after as you type, because the question being
 * answered at the counter is always "what do they owe now?".
 */
export function PaymentForm({
  customers,
  presetCustomerId,
}: {
  customers: CustomerWithBalance[];
  presetCustomerId?: string;
}) {
  const [state, formAction] = useActionState<PaymentFormState, FormData>(
    recordPaymentAction,
    {},
  );

  const [customerId, setCustomerId] = useState(presetCustomerId ?? "");
  const [amount, setAmount] = useState("");

  const customer = customers.find((c) => c.id === customerId);
  const paid = Number(amount) || 0;
  const after = customer ? customer.balance - paid : 0;

  return (
    <form action={formAction} className="shadow-lift rounded-2xl bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="customerId"
          label="Customer"
          required
          className="sm:col-span-2"
          errors={state.fieldErrors?.customerId}
        >
          {(p) => (
            <select
              {...p}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select a shop…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shop_name} — {c.area} (Rs {formatAmount(c.balance)})
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          name="amount"
          label="Amount received (Rs)"
          required
          errors={state.fieldErrors?.amount}
        >
          {(p) => (
            <input
              {...p}
              type="number"
              step="0.01"
              min={0}
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
          name="entryDate"
          label="Date received"
          required
          hint="Backdate it if it came in earlier."
          errors={state.fieldErrors?.entryDate}
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

      {customer && paid > 0 && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-mist-50 p-4 text-sm">
          <div>
            <dt className="text-navy-500 text-xs">Owes now</dt>
            <dd className="font-medium tabular-nums">
              Rs {formatAmount(customer.balance)}
            </dd>
          </div>
          <div>
            <dt className="text-navy-500 text-xs">Paying</dt>
            <dd className="font-medium tabular-nums">
              Rs {formatAmount(paid)}
            </dd>
          </div>
          <div>
            <dt className="text-navy-500 text-xs">Balance after</dt>
            <dd
              className={`font-semibold tabular-nums ${
                after > 0
                  ? "text-amber-700"
                  : after < 0
                    ? "text-emerald-700"
                    : "text-navy-600"
              }`}
            >
              Rs {formatAmount(after)}
              {after < 0 && (
                <span className="ml-1 text-xs font-normal">in credit</span>
              )}
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

      {state.message && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 ring-inset"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      <div className="mt-5">
        <SubmitButton />
      </div>
    </form>
  );
}
