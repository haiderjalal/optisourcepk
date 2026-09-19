"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { todayInKarachi } from "@/lib/format";
import type { Customer } from "@/types/database";
import { saveCustomer, type CustomerFormState } from "./actions";

function SubmitButton({ isUpdate }: { isUpdate: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : isUpdate ? "Save changes" : "Add customer"}
    </Button>
  );
}

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, formAction] = useActionState<CustomerFormState, FormData>(
    saveCustomer,
    {},
  );
  const isUpdate = Boolean(customer);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {customer && <input type="hidden" name="id" value={customer.id} />}

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">Shop</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            name="shopName"
            label="Shop name"
            required
            errors={errors?.shopName}
          >
            {(p) => (
              <input {...p} defaultValue={customer?.shop_name} type="text" />
            )}
          </Field>

          <Field
            name="customerName"
            label="Contact name"
            required
            errors={errors?.customerName}
          >
            {(p) => (
              <input
                {...p}
                defaultValue={customer?.customer_name}
                type="text"
              />
            )}
          </Field>

          <Field
            name="area"
            label="Area"
            required
            hint="Used to group deliveries."
            errors={errors?.area}
          >
            {(p) => <input {...p} defaultValue={customer?.area} type="text" />}
          </Field>

          <Field name="phone" label="Phone" required errors={errors?.phone}>
            {(p) => <input {...p} defaultValue={customer?.phone} type="tel" />}
          </Field>

          <Field name="phoneAlt" label="Second phone" errors={errors?.phoneAlt}>
            {(p) => (
              <input
                {...p}
                defaultValue={customer?.phone_alt ?? ""}
                type="tel"
              />
            )}
          </Field>

          <Field
            name="address"
            label="Delivery address"
            required
            className="sm:col-span-2"
            errors={errors?.address}
          >
            {(p) => (
              <textarea {...p} defaultValue={customer?.address} rows={2} />
            )}
          </Field>
        </div>
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">Account</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            name="defaultDiscountPct"
            label="Default discount %"
            hint="Pre-fills every invoice line. Can be overridden per line."
            errors={errors?.defaultDiscountPct}
          >
            {(p) => (
              <input
                {...p}
                defaultValue={customer?.default_discount_pct ?? 0}
                type="number"
                min={0}
                max={100}
                step="0.01"
                inputMode="decimal"
              />
            )}
          </Field>

          <Field
            name="openingBalance"
            label="Opening balance (Rs)"
            hint="What they already owed. Negative if they are in credit."
            errors={errors?.openingBalance}
          >
            {(p) => (
              <input
                {...p}
                defaultValue={customer?.opening_balance ?? 0}
                type="number"
                step="0.01"
                inputMode="decimal"
              />
            )}
          </Field>

          <Field
            name="openingBalanceDate"
            label="Balance as at"
            required
            errors={errors?.openingBalanceDate}
          >
            {(p) => (
              <input
                {...p}
                defaultValue={
                  customer?.opening_balance_date ?? todayInKarachi()
                }
                type="date"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <Field name="ntn" label="NTN" errors={errors?.ntn}>
              {(p) => (
                <input {...p} defaultValue={customer?.ntn ?? ""} type="text" />
              )}
            </Field>
            <Field name="strn" label="STRN" errors={errors?.strn}>
              {(p) => (
                <input {...p} defaultValue={customer?.strn ?? ""} type="text" />
              )}
            </Field>
          </div>

          <Field
            name="notes"
            label="Notes"
            className="sm:col-span-2"
            errors={errors?.notes}
          >
            {(p) => (
              <textarea {...p} defaultValue={customer?.notes ?? ""} rows={3} />
            )}
          </Field>
        </div>
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
        <SubmitButton isUpdate={isUpdate} />
        <Link
          href="/shop/customers"
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
