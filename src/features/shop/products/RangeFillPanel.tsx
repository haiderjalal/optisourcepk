"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatPower } from "@/lib/format";
import type { Product } from "@/types/database";
import { receiveRangeAction, type RangeFillState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="navy" disabled={pending}>
      <Grid3x3 className="size-4" aria-hidden />
      {pending ? "Creating…" : "Create all bins"}
    </Button>
  );
}

/** How many bins a range will produce, so the size is visible before the click. */
function countBins(product: Product): number {
  const steps = (
    min: number | null,
    max: number | null,
    step: number | null,
  ) => {
    if (min === null || max === null || !step || step <= 0) return 1;
    return Math.floor((max - min) / step + 1e-9) + 1;
  };

  // Eyes do not multiply: a product is either eye-specific or it is not, and
  // either way it is one bin per power combination.
  return (
    steps(product.sph_min, product.sph_max, product.sph_step) *
    steps(product.cyl_min, product.cyl_max, product.cyl_step) *
    steps(product.add_min, product.add_max, product.add_step)
  );
}

/**
 * Lay out a product's whole power grid in one go.
 *
 * Only shown once a range exists — without one there is nothing to fill, and
 * the panel would just be a dead button.
 */
export function RangeFillPanel({ product }: { product: Product }) {
  const [state, formAction] = useActionState<RangeFillState, FormData>(
    receiveRangeAction,
    {},
  );

  const hasRange =
    product.sph_min !== null &&
    product.sph_max !== null &&
    (product.sph_step ?? 0) > 0;

  if (!product.tracks_stock || !hasRange) return null;

  const bins = countBins(product);

  return (
    <form action={formAction} className="shadow-lift rounded-2xl bg-white p-5">
      <input type="hidden" name="productId" value={product.id} />

      <h2 className="text-base font-semibold">Fill the whole range</h2>
      <p className="text-navy-500 mt-1 max-w-prose text-sm">
        Creates a bin for every power from {formatPower(product.sph_min)} to{" "}
        {formatPower(product.sph_max)} in steps of {product.sph_step}
        {product.cyl_min !== null && product.cyl_max !== null
          ? `, across CYL ${formatPower(product.cyl_min)} to ${formatPower(product.cyl_max)}`
          : ""}
        {product.add_min !== null && product.add_max !== null
          ? `, across ADD ${formatPower(product.add_min)} to ${formatPower(product.add_max)}`
          : ""}
        {" — "}
        <strong>{bins} bins</strong>. Bins that already exist are topped up,
        never reset.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          name="qty"
          label={`Quantity each (${product.unit})`}
          required
          hint="0 creates empty bins"
        >
          {(p) => (
            <input
              {...p}
              type="number"
              step="1"
              min={0}
              defaultValue={0}
              inputMode="numeric"
            />
          )}
        </Field>

        <Field
          name="alertQty"
          label="Alert quantity"
          hint="Applied to each bin"
        >
          {(p) => (
            <input
              {...p}
              type="number"
              step="1"
              min={0}
              inputMode="numeric"
              placeholder="Optional"
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
