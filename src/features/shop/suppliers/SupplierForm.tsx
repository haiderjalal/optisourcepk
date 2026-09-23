"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { Supplier } from "@/types/database";
import { saveSupplier, type SupplierFormState } from "./actions";

function SubmitButton({ isUpdate }: { isUpdate: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : isUpdate ? "Save changes" : "Add supplier"}
    </Button>
  );
}

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const [state, formAction] = useActionState<SupplierFormState, FormData>(
    saveSupplier,
    {},
  );
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {supplier && <input type="hidden" name="id" value={supplier.id} />}

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="name"
            label="Supplier name"
            required
            className="sm:col-span-2"
            errors={errors?.name}
          >
            {(p) => (
              <input
                {...p}
                defaultValue={supplier?.name}
                type="text"
                placeholder="e.g. Meta Tech Vision"
              />
            )}
          </Field>

          <Field name="phone" label="Phone" errors={errors?.phone}>
            {(p) => (
              <input {...p} defaultValue={supplier?.phone ?? ""} type="tel" />
            )}
          </Field>

          <Field name="city" label="City" errors={errors?.city}>
            {(p) => (
              <input
                {...p}
                defaultValue={supplier?.city ?? ""}
                type="text"
                placeholder="e.g. Karachi"
              />
            )}
          </Field>

          <Field
            name="address"
            label="Address"
            className="sm:col-span-2"
            errors={errors?.address}
          >
            {(p) => (
              <input
                {...p}
                defaultValue={supplier?.address ?? ""}
                type="text"
              />
            )}
          </Field>

          <Field
            name="notes"
            label="Notes"
            className="sm:col-span-2"
            errors={errors?.notes}
          >
            {(p) => (
              <textarea {...p} defaultValue={supplier?.notes ?? ""} rows={3} />
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
        <SubmitButton isUpdate={Boolean(supplier)} />
        <Link
          href="/shop/suppliers"
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
