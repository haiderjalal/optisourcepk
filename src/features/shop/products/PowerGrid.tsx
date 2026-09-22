"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatPower } from "@/lib/format";
import type { Product, StockBin } from "@/types/database";
import { receivePowersAction, type PowerGridState } from "./actions";

/**
 * Receive a delivery against the product's whole power range.
 *
 * Every power the product is made in gets a row with its current count beside
 * an empty box. Type against the ones that arrived and leave the rest blank —
 * which is what a supplier's delivery note actually looks like.
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
          : `Receive ${total} across ${count} ${count === 1 ? "power" : "powers"}`}
    </Button>
  );
}

/** Every power from min to max, walking in steps. */
function powerList(product: Product): number[] {
  const { sph_min: min, sph_max: max, sph_step: step } = product;
  if (min === null || max === null || !step || step <= 0) return [];

  const out: number[] = [];
  // Accumulate by multiplication rather than repeated addition: adding 0.25
  // eighty times drifts, and the drift shows up as -0.7499999999 on screen.
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  for (let i = 0; i < count && i < 500; i++) {
    out.push(Math.round((min + i * step) * 100) / 100);
  }
  return out;
}

const cell =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-center text-sm outline-none transition-colors";

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

  const powers = useMemo(() => powerList(product), [product]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [cyl, setCyl] = useState("");
  const [addPower, setAddPower] = useState("");
  const [eye, setEye] = useState("");

  if (!product.tracks_stock || powers.length === 0) return null;

  // Match the rows against the bins for the currently selected CYL/ADD/eye, so
  // "on hand" always describes the shelf position being typed into.
  const norm = (v: string) => {
    const n = Number(v);
    return v.trim() === "" || n === 0 ? null : n;
  };
  const selCyl = norm(cyl);
  const selAdd = norm(addPower);
  const selEye = eye === "" ? null : eye;

  const onHand = new Map(
    bins
      .filter(
        (b) =>
          (b.cyl ?? null) === selCyl &&
          (b.add_power ?? null) === selAdd &&
          (b.eye ?? null) === selEye,
      )
      .map((b) => [b.sph ?? 0, b.qty_on_hand]),
  );

  const entries = powers
    .map((sph) => ({ sph, qty: Number(quantities[String(sph)] ?? "") || 0 }))
    .filter((e) => e.qty !== 0);

  const totalUnits = entries.reduce((sum, e) => sum + e.qty, 0);

  return (
    <form action={formAction} className="shadow-lift rounded-2xl bg-white p-5">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <h2 className="text-base font-semibold">Receive a delivery</h2>
      <p className="text-navy-500 mt-1 max-w-prose text-sm">
        Every power this product is made in, from {formatPower(product.sph_min)}{" "}
        to {formatPower(product.sph_max)} in steps of {product.sph_step}. Type
        against the ones that arrived and leave the rest blank.
      </p>

      {/* These apply to the whole batch: one delivery is normally one
          cylinder and one addition, across many spheres. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field name="cyl" label="CYL" hint="Applies to every row">
          {(p) => (
            <input
              {...p}
              type="number"
              step={product.cyl_step ?? 0.25}
              inputMode="decimal"
              placeholder="Blank"
              value={cyl}
              onChange={(e) => setCyl(e.target.value)}
            />
          )}
        </Field>

        <Field name="addPower" label="ADD" hint="Applies to every row">
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

        <Field name="eye" label="Eye">
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
          hint="Applies to every row"
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

      <div className="mt-5 overflow-hidden rounded-xl border border-mist-200">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Quantity received against each power
          </caption>
          <thead>
            <tr className="text-navy-500 bg-mist-100 text-left text-xs">
              <th scope="col" className="w-28 px-3 py-2.5 font-medium">
                Power
              </th>
              <th
                scope="col"
                className="w-24 px-3 py-2.5 text-right font-medium"
              >
                On hand
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Received
              </th>
            </tr>
          </thead>
          <tbody>
            {powers.map((sph) => {
              const key = String(sph);
              const have = onHand.get(sph) ?? 0;
              const typed = Number(quantities[key] ?? "") || 0;

              return (
                <tr
                  key={key}
                  className={`border-t border-mist-200 ${
                    typed > 0 ? "bg-emerald-50/50" : ""
                  }`}
                >
                  <td className="px-3 py-1.5 font-mono font-medium">
                    {formatPower(sph)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${
                      have === 0 ? "text-navy-300" : "text-navy-600"
                    }`}
                  >
                    {have}
                    {typed > 0 && (
                      <span className="ml-1.5 font-medium text-emerald-700">
                        → {have + typed}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="1"
                      min={0}
                      inputMode="numeric"
                      aria-label={`Quantity received at ${formatPower(sph)}`}
                      className={cell}
                      value={quantities[key] ?? ""}
                      onChange={(e) =>
                        setQuantities((q) => ({ ...q, [key]: e.target.value }))
                      }
                    />
                  </td>
                </tr>
              );
            })}
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
