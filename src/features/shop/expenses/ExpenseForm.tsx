"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { COMMON_EXPENSES } from "@/lib/validations/shop/expense";
import { addExpenseAction, type ExpenseFormState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Adding…" : "Add expense"}
    </Button>
  );
}

/**
 * Enter one expense at a time. The date stays put and the rest clears after
 * each save, because expenses are usually entered in a run from a notebook.
 */
export function ExpenseForm({ defaultDate }: { defaultDate: string }) {
  const [date, setDate] = useState(defaultDate);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [state, formAction] = useActionState<ExpenseFormState, FormData>(
    async (previous, formData) => {
      const result = await addExpenseAction(previous, formData);
      if (!result.error) {
        setItem("");
        setAmount("");
        setNote("");
      }
      return result;
    },
    {},
  );
  const errors = state.fieldErrors;

  return (
    <form
      action={formAction}
      className="shadow-lift mb-5 rounded-2xl bg-white p-5"
      noValidate
    >
      <h2 className="text-base font-semibold">Add an expense</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          name="expenseDate"
          label="Date"
          required
          errors={errors?.expenseDate}
        >
          {(p) => (
            <input
              {...p}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </Field>

        <Field name="item" label="Item" required errors={errors?.item}>
          {(p) => (
            <input
              {...p}
              type="text"
              list="expense-items"
              placeholder="e.g. Chai"
              value={item}
              onChange={(e) => setItem(e.target.value)}
            />
          )}
        </Field>
        <datalist id="expense-items">
          {COMMON_EXPENSES.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <Field
          name="amount"
          label="Amount (Rs)"
          required
          errors={errors?.amount}
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

        <Field name="note" label="Note" errors={errors?.note}>
          {(p) => (
            <input
              {...p}
              type="text"
              placeholder="Optional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Submit />
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
  );
}
