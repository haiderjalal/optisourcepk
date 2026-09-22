"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { STOCK_REASONS } from "@/lib/validations/shop/stock";
import { formatPower } from "@/lib/format";
import type { Product, StockBin } from "@/types/database";
import { adjustStockAction, type StockFormState } from "./actions";

/** "SPH and CYL", "SPH", "product" — how this product divides its shelf. */
function describeKey(product: Product): string {
  const parts: string[] = [];
  if (product.tracks_power) parts.push("SPH");
  if (product.tracks_cyl) parts.push("CYL");
  if (product.tracks_add) parts.push("ADD");
  if (product.tracks_eye) parts.push("eye");
  if (parts.length === 0) return "product";
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

/** The shelf position of one bin, as the operator reads it. */
export function describeBin(bin: {
  sph: number | null;
  cyl: number | null;
  add_power: number | null;
  eye: string | null;
}): string {
  const parts: string[] = [];
  if (bin.sph !== null) parts.push(formatPower(bin.sph));
  if (bin.cyl !== null) parts.push(formatPower(bin.cyl));
  if (bin.add_power !== null) parts.push("A" + formatPower(bin.add_power));
  if (bin.eye) parts.push(bin.eye);
  return parts.join(" ");
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <PackagePlus className="size-4" aria-hidden />
      {pending ? "Applying…" : "Apply"}
    </Button>
  );
}

/**
 * Stock for one product.
 *
 * For a lens this is a grid of powers; for anything else it is a single bin.
 * The form stays on the page after each adjustment and reports the new
 * quantity, because stock is entered in long runs of powers.
 */
export function StockPanel({
  product,
  bins,
}: {
  product: Product;
  bins: StockBin[];
}) {
  const [state, formAction] = useActionState<StockFormState, FormData>(
    adjustStockAction,
    {},
  );
  const errors = state.fieldErrors;

  if (!product.tracks_stock) {
    return (
      <p className="text-navy-500 rounded-2xl border border-dashed border-mist-300 bg-white/60 px-5 py-8 text-center text-sm">
        This is a service — it is billed per job and never held in stock.
      </p>
    );
  }

  const total = bins.reduce((sum, bin) => sum + bin.qty_on_hand, 0);

  return (
    <div className="space-y-5">
      <form
        action={formAction}
        className="shadow-lift rounded-2xl bg-white p-5"
      >
        <input type="hidden" name="productId" value={product.id} />

        {/* Only the attributes this product is split by are asked for; the
            rest are sent blank, and the database flattens them to NULL so the
            bin key stays exactly as wide as the product needs. */}
        {!product.tracks_power && <input type="hidden" name="sph" value="" />}
        {!product.tracks_cyl && <input type="hidden" name="cyl" value="" />}
        {!product.tracks_add && (
          <input type="hidden" name="addPower" value="" />
        )}
        {!product.tracks_eye && <input type="hidden" name="eye" value="" />}

        <h2 className="text-base font-semibold">Receive or adjust</h2>
        <p className="text-navy-500 mt-1 text-sm">
          Stock is held per {describeKey(product)}. Receiving the same
          combination again adds to it.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {product.tracks_power && (
            <Field
              name="sph"
              label="SPH"
              required
              hint="0.25 steps"
              errors={errors?.sph}
            >
              {(p) => (
                <input
                  {...p}
                  type="number"
                  step="0.25"
                  min={-30}
                  max={30}
                  inputMode="decimal"
                  placeholder="-2.00"
                />
              )}
            </Field>
          )}

          {product.tracks_cyl && (
            <Field
              name="cyl"
              label="CYL"
              hint="0.25 steps"
              errors={errors?.cyl}
            >
              {(p) => (
                <input
                  {...p}
                  type="number"
                  step="0.25"
                  min={-12}
                  max={12}
                  inputMode="decimal"
                  placeholder="-0.50"
                />
              )}
            </Field>
          )}

          {product.tracks_add && (
            <Field
              name="addPower"
              label="ADD"
              hint="0.25 steps"
              errors={errors?.addPower}
            >
              {(p) => (
                <input
                  {...p}
                  type="number"
                  step="0.25"
                  min={0.25}
                  max={6}
                  inputMode="decimal"
                  placeholder="+1.50"
                />
              )}
            </Field>
          )}

          {product.tracks_eye && (
            <Field name="eye" label="Eye" errors={errors?.eye}>
              {(p) => (
                <select {...p} defaultValue="">
                  <option value="">Either</option>
                  <option value="R">Right</option>
                  <option value="L">Left</option>
                </select>
              )}
            </Field>
          )}

          <Field
            name="delta"
            label={`Quantity (${product.unit})`}
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
            {(p) => <input {...p} type="text" placeholder="Optional" />}
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SubmitButton />

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

      <div className="shadow-lift rounded-2xl bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">
            {product.tracks_power ? "On hand by power" : "On hand"}
          </h2>
          <p className="text-navy-500 text-sm">
            {total} {product.unit} across {bins.length}{" "}
            {bins.length === 1 ? "bin" : "bins"}
          </p>
        </div>

        {bins.length === 0 ? (
          <p className="text-navy-400 mt-4 text-sm">
            Nothing received yet. The first adjustment creates the bin.
          </p>
        ) : product.tracks_power ? (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {bins.map((bin) => (
              <li
                key={bin.id}
                className={`rounded-lg px-2 py-2 text-center ${
                  bin.qty_on_hand <= bin.reorder_level
                    ? "bg-amber-50 ring-1 ring-amber-200 ring-inset"
                    : "bg-mist-100"
                }`}
              >
                <span className="text-navy-500 block font-mono text-xs">
                  {describeBin(bin)}
                </span>
                <span className="block text-lg font-semibold tabular-nums">
                  {bin.qty_on_hand}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {bins[0].qty_on_hand}
            <span className="text-navy-400 ml-2 text-base font-normal">
              {product.unit}
            </span>
          </p>
        )}

        {bins.some((bin) => bin.qty_on_hand <= bin.reorder_level) && (
          <p className="text-navy-400 mt-3 text-xs">
            Amber means at or below the reorder level.
          </p>
        )}
      </div>
    </div>
  );
}
