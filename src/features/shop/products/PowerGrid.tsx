"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatPower } from "@/lib/format";
import type { Product, StockBin } from "@/types/database";
import { receivePowersAction, type PowerGridState } from "./actions";

/**
 * Receive a delivery against the product's whole range.
 *
 * SPH runs down the side. When the product also has a CYL range, CYL runs
 * across the top and every square is its own box — which is how a matrix of
 * stock lenses physically sits on the shelf. Without a CYL range it stays a
 * single column.
 *
 * ADD and eye remain batch-wide selectors rather than a third axis: a grid you
 * have to scroll in three directions is not a grid anybody can use.
 */

function Submit({ count, total }: { count: number; total: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending || count === 0}>
      <PackagePlus className="size-4" aria-hidden />
      {pending
        ? "Receiving…"
        : count === 0
          ? "Enter quantities above"
          : `Receive ${total} across ${count} ${count === 1 ? "bin" : "bins"}`}
    </Button>
  );
}

/**
 * Every value from min to max, walking in steps.
 *
 * Built by multiplying the step rather than adding it repeatedly: adding 0.25
 * eighty times drifts, and the drift surfaces as -0.7499999999 on screen and
 * as a missed bin match underneath.
 */
function series(
  min: number | null,
  max: number | null,
  step: number | null,
  cap: number,
): number[] {
  if (min === null || max === null || !step || step <= 0) return [];
  const count = Math.min(Math.floor((max - min) / step + 1e-9) + 1, cap);
  return Array.from(
    { length: count },
    (_, i) => Math.round((min + i * step) * 100) / 100,
  );
}

const cell =
  "border-mist-300 focus:border-accent-600 w-16 rounded-md border bg-white px-1.5 py-1 text-center text-sm outline-none transition-colors";

export function PowerGrid({
  product,
  bins,
}: {
  product: Product;
  bins: StockBin[];
}) {
  const [state, formAction] = useActionState<PowerGridState, FormData>(
    receivePowersAction,
    {},
  );

  const spheres = useMemo(
    () => series(product.sph_min, product.sph_max, product.sph_step, 200),
    [product],
  );
  const cylinders = useMemo(
    () => series(product.cyl_min, product.cyl_max, product.cyl_step, 60),
    [product],
  );

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [addPower, setAddPower] = useState("");
  const [eye, setEye] = useState("");

  if (!product.tracks_stock || spheres.length === 0) return null;

  // One column of `null` keeps the matrix and the plain list on one code path.
  const columns: (number | null)[] = cylinders.length > 0 ? cylinders : [null];
  const isMatrix = cylinders.length > 0;

  const norm = (v: string) => {
    const n = Number(v);
    return v.trim() === "" || n === 0 ? null : n;
  };
  const selAdd = norm(addPower);
  const selEye = eye === "" ? null : eye;

  const key = (sph: number, cyl: number | null) => `${sph}|${cyl ?? ""}`;

  // Current counts for the ADD and eye in play, so the numbers on screen
  // always describe the shelf position being typed into.
  const onHand = new Map(
    bins
      .filter(
        (b) => (b.add_power ?? null) === selAdd && (b.eye ?? null) === selEye,
      )
      .map((b) => [key(b.sph ?? 0, b.cyl ?? null), b.qty_on_hand]),
  );

  const entries = spheres.flatMap((sph) =>
    columns.flatMap((cyl) => {
      const qty = Number(quantities[key(sph, cyl)] ?? "") || 0;
      return qty === 0 ? [] : [{ sph, cyl, qty }];
    }),
  );

  const totalUnits = entries.reduce((sum, e) => sum + e.qty, 0);

  return (
    <form action={formAction} className="shadow-lift rounded-2xl bg-white p-5">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <h2 className="text-base font-semibold">Receive a delivery</h2>
      <p className="text-navy-500 mt-1 max-w-prose text-sm">
        {isMatrix
          ? `Every SPH from ${formatPower(product.sph_min)} to ${formatPower(product.sph_max)} against every CYL from ${formatPower(product.cyl_min)} to ${formatPower(product.cyl_max)}.`
          : `Every power from ${formatPower(product.sph_min)} to ${formatPower(product.sph_max)} in steps of ${product.sph_step}.`}{" "}
        Type against what arrived and leave the rest blank. The small grey
        figure is what is already on hand.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="addPower" label="ADD" hint="Applies to the whole delivery">
          {(p) => (
            <input
              {...p}
              type="number"
              step={product.add_step ?? 0.25}
              inputMode="decimal"
              placeholder="Blank"
              value={addPower}
              onChange={(e) => setAddPower(e.target.value)}
            />
          )}
        </Field>

        <Field name="eye" label="Eye" hint="Applies to the whole delivery">
          {(p) => (
            <select {...p} value={eye} onChange={(e) => setEye(e.target.value)}>
              <option value="">Either</option>
              <option value="R">Right</option>
              <option value="L">Left</option>
            </select>
          )}
        </Field>

        <Field
          name="alertQty"
          label="Alert quantity"
          hint="Applies to every bin touched"
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
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-mist-200">
        <table className="text-sm">
          <caption className="sr-only">
            Quantity received against each power
          </caption>
          <thead>
            <tr className="text-navy-500 bg-mist-100 text-xs">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-mist-100 px-3 py-2.5 text-left font-medium"
              >
                {isMatrix ? "SPH ╲ CYL" : "Power"}
              </th>
              {columns.map((cyl) => (
                <th
                  key={cyl ?? "none"}
                  scope="col"
                  className="px-2 py-2.5 text-center font-mono font-medium"
                >
                  {cyl === null ? "Received" : formatPower(cyl)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spheres.map((sph) => (
              <tr key={sph} className="border-t border-mist-200">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-mono font-medium"
                >
                  {formatPower(sph)}
                </th>

                {columns.map((cyl) => {
                  const k = key(sph, cyl);
                  const have = onHand.get(k) ?? 0;
                  const typed = Number(quantities[k] ?? "") || 0;

                  return (
                    <td
                      key={cyl ?? "none"}
                      className={`px-2 py-1.5 ${typed > 0 ? "bg-emerald-50" : ""}`}
                    >
                      <input
                        type="number"
                        step="1"
                        min={0}
                        inputMode="numeric"
                        aria-label={
                          cyl === null
                            ? `Received at SPH ${formatPower(sph)}`
                            : `Received at SPH ${formatPower(sph)} CYL ${formatPower(cyl)}`
                        }
                        className={cell}
                        value={quantities[k] ?? ""}
                        onChange={(e) =>
                          setQuantities((q) => ({ ...q, [k]: e.target.value }))
                        }
                      />
                      <span
                        className={`mt-0.5 block text-center text-[10px] tabular-nums ${
                          typed > 0
                            ? "font-medium text-emerald-700"
                            : "text-navy-300"
                        }`}
                      >
                        {typed > 0 ? `${have} → ${have + typed}` : have}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field name="note" label="Note" hint="Supplier or invoice number">
          {(p) => <input {...p} type="text" placeholder="Optional" />}
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Submit count={entries.length} total={totalUnits} />

        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => setQuantities({})}
            className="text-navy-500 hover:text-navy-700 text-sm font-medium"
          >
            Clear
          </button>
        )}

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
