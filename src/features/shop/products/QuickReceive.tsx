"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Check, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { sphPlaceholder } from "@/lib/power";
import { STOCK_REASONS } from "@/lib/validations/shop/stock";
import type { Product } from "@/types/database";
import { adjustStockAction, type StockFormState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <PackagePlus className="size-4" aria-hidden />
      {pending ? "Applying…" : "Add to stock"}
    </Button>
  );
}

/**
 * Take stock in without leaving the stock screen.
 *
 * This is the receiving desk: a delivery arrives, you work down the invoice.
 * Opening a product page for each line would be the slow way round, so the
 * product is a field here like any other, and the form stays put and reports
 * the new count after each one.
 */
export function QuickReceive({ products }: { products: Product[] }) {
  const [state, formAction] = useActionState<StockFormState, FormData>(
    adjustStockAction,
    {},
  );
  const [productId, setProductId] = useState("");

  const product = products.find((p) => p.id === productId);
  const errors = state.fieldErrors;

  if (products.length === 0) return null;

  return (
    <form
      action={formAction}
      className="shadow-lift mb-5 rounded-2xl bg-white p-5"
    >
      <h2 className="text-base font-semibold">Receive stock</h2>
      <p className="text-navy-500 mt-1 max-w-prose text-sm">
        Add stock one power at a time. Fill in only the values that divide your
        shelf. For a supplier delivery,{" "}
        <Link
          href="/shop/purchases/new"
          className="text-accent-600 hover:text-accent-700 font-medium"
        >
          record the purchase invoice
        </Link>{" "}
        instead, so you know where it came from.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          name="productId"
          label="Product"
          required
          className="lg:col-span-2"
          errors={errors?.productId}
        >
          {(p) => (
            <select
              {...p}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select a product…</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field name="sph" label="SPH" hint="0.25 steps" errors={errors?.sph}>
          {(p) => (
            <input
              {...p}
              type="number"
              step={product?.sph_step ?? 0.25}
              min={product?.sph_min ?? -30}
              max={product?.sph_max ?? 30}
              inputMode="decimal"
              placeholder={sphPlaceholder(product?.lens_sign)}
            />
          )}
        </Field>

        <Field name="cyl" label="CYL" hint="0.25 steps" errors={errors?.cyl}>
          {(p) => (
            <input
              {...p}
              type="number"
              step={product?.cyl_step ?? 0.25}
              min={product?.cyl_min ?? -12}
              max={product?.cyl_max ?? 12}
              inputMode="decimal"
              placeholder="-0.50"
            />
          )}
        </Field>

        <Field name="addPower" label="ADD" errors={errors?.addPower}>
          {(p) => (
            <input
              {...p}
              type="number"
              step={product?.add_step ?? 0.25}
              min={product?.add_min ?? 0}
              max={product?.add_max ?? 6}
              inputMode="decimal"
              placeholder="+1.50"
            />
          )}
        </Field>

        <Field name="eye" label="Eye" errors={errors?.eye}>
          {(p) => (
            <select {...p} defaultValue="">
              <option value="">Either</option>
              <option value="R">Right</option>
              <option value="L">Left</option>
            </select>
          )}
        </Field>

        <Field
          name="delta"
          label={`Quantity (${product?.unit ?? "pcs"})`}
          required
          hint="Negative to write off"
          errors={errors?.delta}
        >
          {(p) => <input {...p} type="number" step="1" inputMode="numeric" />}
        </Field>

        <Field
          name="alertQty"
          label="Alert quantity"
          hint="Warn at or below this"
          errors={errors?.alertQty}
        >
          {(p) => (
            <input
              {...p}
              type="number"
              step="1"
              min={0}
              inputMode="numeric"
              placeholder="Leave blank to keep"
            />
          )}
        </Field>

        <Field name="reason" label="Reason" required errors={errors?.reason}>
          {(p) => (
            <select {...p} defaultValue="purchase">
              {STOCK_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field name="note" label="Note" errors={errors?.note}>
          {(p) => (
            <input {...p} type="text" placeholder="Supplier, invoice no." />
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
