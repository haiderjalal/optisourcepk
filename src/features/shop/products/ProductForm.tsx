"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PRODUCT_CATEGORIES } from "@/lib/validations/shop/product";
import type { Product } from "@/types/database";
import { saveProduct, type ProductFormState } from "./actions";

function SubmitButton({ isUpdate }: { isUpdate: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : isUpdate ? "Save changes" : "Add product"}
    </Button>
  );
}

export function ProductForm({ product }: { product?: Product }) {
  const [state, formAction] = useActionState<ProductFormState, FormData>(
    saveProduct,
    {},
  );
  const errors = state.fieldErrors;

  const [sale, setSale] = useState(String(product?.list_price ?? 0));
  const [cost, setCost] = useState(String(product?.purchase_price ?? 0));

  // Margin is the number the owner actually cares about, so show it rather
  // than leave it to be worked out from two boxes.
  const saleNum = Number(sale) || 0;
  const costNum = Number(cost) || 0;
  const marginHint =
    saleNum > 0 && costNum > 0
      ? `Margin Rs ${(saleNum - costNum).toFixed(2)} (${(
          ((saleNum - costNum) / saleNum) *
          100
        ).toFixed(1)}%)`
      : "What you pay for it.";

  const [tracksStock, setTracksStock] = useState(product?.tracks_stock ?? true);
  const [tracksPower, setTracksPower] = useState(
    product?.tracks_power ?? false,
  );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {product && <input type="hidden" name="id" value={product.id} />}

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="sku" label="SKU" required errors={errors?.sku}>
            {(p) => (
              <input
                {...p}
                defaultValue={product?.sku}
                type="text"
                autoCapitalize="characters"
              />
            )}
          </Field>

          <Field name="unit" label="Unit" required errors={errors?.unit}>
            {(p) => (
              <input
                {...p}
                defaultValue={product?.unit ?? "pcs"}
                type="text"
                list="unit-options"
              />
            )}
          </Field>
          <datalist id="unit-options">
            <option value="pairs" />
            <option value="pcs" />
            <option value="boxes" />
            <option value="packs" />
            <option value="cartons" />
          </datalist>

          <Field
            name="name"
            label="Product name"
            required
            className="sm:col-span-2"
            errors={errors?.name}
          >
            {(p) => <input {...p} defaultValue={product?.name} type="text" />}
          </Field>

          <Field
            name="category"
            label="Category"
            required
            errors={errors?.category}
          >
            {(p) => (
              <select {...p} defaultValue={product?.category ?? "lenses"}>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div />

          <Field
            name="listPrice"
            label="Sale price (Rs)"
            hint="Before any customer discount."
            errors={errors?.listPrice}
          >
            {(p) => (
              <input
                {...p}
                value={sale}
                onChange={(e) => setSale(e.target.value)}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
              />
            )}
          </Field>

          <Field
            name="purchasePrice"
            label="Purchase price (Rs)"
            hint={marginHint}
            errors={errors?.purchasePrice}
          >
            {(p) => (
              <input
                {...p}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
              />
            )}
          </Field>
        </div>
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">How it is stocked</h2>

        <label className="mt-4 flex gap-3 rounded-lg border border-mist-200 p-3.5">
          <input
            type="checkbox"
            name="tracksStock"
            checked={tracksStock}
            disabled={tracksPower}
            onChange={(e) => setTracksStock(e.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">We hold stock</span>
            <span className="text-navy-500 block text-xs">
              Leave off for coatings and tints. They are billed per job and
              never held, so they get no stock bin at all.
            </span>
          </span>
        </label>

        {/* A disabled checkbox submits nothing, so carry the real value. */}
        {tracksPower && <input type="hidden" name="tracksStock" value="on" />}

        <label className="mt-3 flex gap-3 rounded-lg border border-mist-200 p-3.5">
          <input
            type="checkbox"
            name="tracksPower"
            checked={tracksPower}
            onChange={(e) => {
              setTracksPower(e.target.checked);
              if (e.target.checked) setTracksStock(true);
            }}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">It has a power</span>
            <span className="text-navy-500 block text-xs">
              Lenses. Ticking this counts them towards the Lens Qty on the
              invoice. Stock is keyed by whatever you type when receiving it —
              SPH alone, or SPH with CYL, ADD and eye.
            </span>
          </span>
        </label>

        {errors?.tracksStock && (
          <p className="mt-2 text-xs text-amber-700">{errors.tracksStock[0]}</p>
        )}

        {product && product.tracks_power !== tracksPower && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-amber-200 ring-inset">
            Changing how a product is split while it already holds stock leaves
            the existing bins where they are. Clear its stock first if you want
            a clean start.
          </p>
        )}
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
        <SubmitButton isUpdate={Boolean(product)} />
        <Link
          href="/shop/products"
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
