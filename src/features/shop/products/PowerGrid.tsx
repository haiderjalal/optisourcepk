"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Check, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatPower, todayInKarachi } from "@/lib/format";
import { isLow, powerSeries } from "@/lib/power";
import type { Product, StockBin, Supplier } from "@/types/database";
import { receivePowersAction, type PowerGridState } from "./actions";

/**
 * Receive a delivery against the product's whole range.
 *
 * SPH runs across the top and CYL down the side, both starting nearest zero
 * (-0.25, -0.50, -0.75 …) — the way a stock sheet is read. Without a CYL
 * range it is a single row of SPH boxes.
 *
 * ADD and eye remain batch-wide selectors rather than a third axis: a grid you
 * have to scroll in three directions is not a grid anybody can use.
 *
 * Picking a supplier records the delivery as a purchase invoice; leaving it
 * blank is for opening stock or a count, with no invoice behind it.
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

const cell =
  "border-mist-300 focus:border-accent-600 w-16 rounded-md border bg-white px-1.5 py-1 text-center text-sm outline-none transition-colors";

export function PowerGrid({
  product,
  bins,
  suppliers,
}: {
  product: Product;
  bins: StockBin[];
  suppliers: Supplier[];
}) {
  const [state, formAction] = useActionState<PowerGridState, FormData>(
    receivePowersAction,
    {},
  );

  const spheres = useMemo(
    () => powerSeries(product.sph_min, product.sph_max, product.sph_step, 200),
    [product],
  );
  const cylinders = useMemo(
    () => powerSeries(product.cyl_min, product.cyl_max, product.cyl_step, 60),
    [product],
  );

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [addPower, setAddPower] = useState("");
  const [eye, setEye] = useState("");
  // Controlled so a failed save keeps them: React resets uncontrolled fields
  // once a form action finishes.
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayInKarachi);
  const [unitCost, setUnitCost] = useState(String(product.purchase_price));
  const [note, setNote] = useState("");

  if (!product.tracks_stock || spheres.length === 0) return null;

  // One row of `null` keeps the matrix and the plain strip on one code path.
  const rows: (number | null)[] = cylinders.length > 0 ? cylinders : [null];
  const isMatrix = cylinders.length > 0;

  const norm = (v: string) => {
    const n = Number(v);
    return v.trim() === "" || n === 0 ? null : n;
  };
  const selAdd = norm(addPower);
  const selEye = eye === "" ? null : eye;

  const key = (sph: number, cyl: number | null) => `${sph}|${cyl ?? ""}`;

  // Current bins for the ADD and eye in play, so the numbers on screen
  // always describe the shelf position being typed into.
  const onHand = new Map(
    bins
      .filter(
        (b) => (b.add_power ?? null) === selAdd && (b.eye ?? null) === selEye,
      )
      .map((b) => [key(b.sph ?? 0, b.cyl ?? null), b]),
  );

  const entries = rows.flatMap((cyl) =>
    spheres.flatMap((sph) => {
      const qty = Number(quantities[key(sph, cyl)] ?? "") || 0;
      return qty === 0 ? [] : [{ sph, cyl, qty }];
    }),
  );

  const totalUnits = entries.reduce((sum, e) => sum + e.qty, 0);
  const alertAt = product.alert_qty;

  return (
    <form action={formAction} className="shadow-lift rounded-2xl bg-white p-5">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <h2 className="text-base font-semibold">Receive a delivery</h2>
      <p className="text-navy-500 mt-1 max-w-prose text-sm">
        {isMatrix
          ? "SPH across the top, CYL down the side."
          : `Every SPH in the range, in steps of ${product.sph_step}.`}{" "}
        Type against what arrived and leave the rest blank. The small figure is
        what is already on hand
        {alertAt !== null && ` — amber at ${alertAt} or below`}.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                className="sticky left-0 z-10 bg-mist-100 px-3 py-2.5 text-left font-medium whitespace-nowrap"
              >
                {isMatrix ? "CYL ╲ SPH" : "SPH"}
              </th>
              {spheres.map((sph) => (
                <th
                  key={sph}
                  scope="col"
                  className="px-2 py-2.5 text-center font-mono font-medium"
                >
                  {formatPower(sph)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cyl) => (
              <tr key={cyl ?? "none"} className="border-t border-mist-200">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-mono font-medium whitespace-nowrap"
                >
                  {cyl === null ? "Qty" : formatPower(cyl)}
                </th>

                {spheres.map((sph) => {
                  const k = key(sph, cyl);
                  const bin = onHand.get(k);
                  const have = bin?.qty_on_hand ?? 0;
                  const typed = Number(quantities[k] ?? "") || 0;
                  // No bin is 0 on hand, which is always at or below an alert.
                  const low = bin ? isLow(bin, product) : alertAt !== null;

                  return (
                    <td
                      key={sph}
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
                            : low
                              ? "font-medium text-amber-700"
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

      <h3 className="mt-6 text-sm font-semibold">Purchase invoice</h3>
      <p className="text-navy-500 mt-1 max-w-prose text-xs">
        Where this delivery came from. The same supplier and invoice number
        again adds to that invoice, so a mixed delivery can be entered one
        product at a time. Leave the supplier blank for opening stock.
        {suppliers.length === 0 && (
          <>
            {" "}
            <Link
              href="/shop/suppliers/new"
              className="text-accent-600 hover:text-accent-700 font-medium"
            >
              Add a supplier
            </Link>{" "}
            first to record one.
          </>
        )}
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field name="supplierId" label="Supplier">
          {(p) => (
            <select
              {...p}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">None — opening stock</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        {supplierId ? (
          <>
            <Field name="invoiceNo" label="Their invoice no." required>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  placeholder="e.g. 292055"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
              )}
            </Field>

            <Field name="invoiceDate" label="Invoice date" required>
              {(p) => (
                <input
                  {...p}
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              )}
            </Field>

            <Field
              name="unitCost"
              label="Unit cost (Rs)"
              hint="Per piece, for every power here"
            >
              {(p) => (
                <input
                  {...p}
                  type="number"
                  step="0.01"
                  min={0}
                  inputMode="decimal"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              )}
            </Field>
          </>
        ) : (
          <Field name="note" label="Note" className="lg:col-span-3">
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
        )}
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
            {state.purchaseId && (
              <Link
                href={`/shop/purchases/${state.purchaseId}`}
                className="font-medium underline underline-offset-2"
              >
                View invoice
              </Link>
            )}
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
