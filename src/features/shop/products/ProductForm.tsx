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

  const RANGES = [
    {
      label: "SPH — sphere",
      fields: [
        {
          name: "sphMin",
          label: "Min",
          step: "0.25",
          min: -30,
          max: 30,
          placeholder: "-6.00",
          value: product?.sph_min,
        },
        {
          name: "sphMax",
          label: "Max",
          step: "0.25",
          min: -30,
          max: 30,
          placeholder: "+4.00",
          value: product?.sph_max,
        },
        {
          name: "sphStep",
          label: "Step",
          step: "0.25",
          min: 0.25,
          max: 5,
          placeholder: "0.25",
          value: product?.sph_step,
        },
      ],
    },
    {
      label: "CYL — cylinder",
      fields: [
        {
          name: "cylMin",
          label: "Min",
          step: "0.25",
          min: -12,
          max: 12,
          placeholder: "-2.00",
          value: product?.cyl_min,
        },
        {
          name: "cylMax",
          label: "Max",
          step: "0.25",
          min: -12,
          max: 12,
          placeholder: "0.00",
          value: product?.cyl_max,
        },
        {
          name: "cylStep",
          label: "Step",
          step: "0.25",
          min: 0.25,
          max: 5,
          placeholder: "0.25",
          value: product?.cyl_step,
        },
      ],
    },
    {
      label: "ADD — addition",
      fields: [
        {
          name: "addMin",
          label: "Min",
          step: "0.25",
          min: 0,
          max: 6,
          placeholder: "1.00",
          value: product?.add_min,
        },
        {
          name: "addMax",
          label: "Max",
          step: "0.25",
          min: 0,
          max: 6,
          placeholder: "3.00",
          value: product?.add_max,
        },
        {
          name: "addStep",
          label: "Step",
          step: "0.25",
          min: 0.25,
          max: 5,
          placeholder: "0.25",
          value: product?.add_step,
        },
      ],
    },
    {
      label: "Axis",
      fields: [
        {
          name: "axisMin",
          label: "Min",
          step: "1",
          min: 0,
          max: 180,
          placeholder: "0",
          value: product?.axis_min,
        },
        {
          name: "axisMax",
          label: "Max",
          step: "1",
          min: 0,
          max: 180,
          placeholder: "180",
          value: product?.axis_max,
        },
        {
          name: "axisStep",
          label: "Step",
          step: "1",
          min: 1,
          max: 180,
          placeholder: "10",
          value: product?.axis_step,
        },
      ],
    },
  ];

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

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">Power range</h2>
        <p className="text-navy-500 mt-1 max-w-prose text-sm">
          The range this product is made in. Leave it blank if it has none.
          Setting a range bounds and steps the inputs when you receive stock,
          and lets you create every bin in the range in one go.
        </p>

        <div className="mt-4 space-y-4">
          {RANGES.map((row) => (
            <div key={row.label}>
              <p className="text-navy-600 text-sm font-medium">{row.label}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {row.fields.map((field) => (
                  <Field
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    errors={errors?.[field.name]}
                  >
                    {(p) => (
                      <input
                        {...p}
                        type="number"
                        step={field.step}
                        min={field.min}
                        max={field.max}
                        inputMode="decimal"
                        placeholder={field.placeholder}
                        defaultValue={field.value ?? ""}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          ))}

          <Field name="eyes" label="Eyes" className="sm:max-w-xs">
            {(p) => (
              <select {...p} defaultValue={product?.eyes ?? ""}>
                <option value="">Not specified</option>
                <option value="both">Both — not eye-specific</option>
                <option value="R">Right only</option>
                <option value="L">Left only</option>
              </select>
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
