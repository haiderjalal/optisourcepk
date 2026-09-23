"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Copy, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatAmount, todayInKarachi } from "@/lib/format";
import { sphPlaceholder } from "@/lib/power";
import type { Product, PurchaseLineInput, Supplier } from "@/types/database";
import { savePurchase, type PurchaseFormState } from "./actions";

/**
 * Enter a supplier's invoice line by line, as it is printed.
 *
 * Saving it takes the stock in. Totals here are for the eye only — the
 * database stores quantity and unit cost and works the line totals out itself.
 */

interface LineDraft {
  key: string;
  productId: string;
  eye: "" | "R" | "L";
  sph: string;
  cyl: string;
  add: string;
  qty: string;
  unitCost: string;
}

let seq = 0;
const nextKey = () => `purchase-line-${++seq}`;

function emptyLine(): LineDraft {
  return {
    key: nextKey(),
    productId: "",
    eye: "",
    sph: "",
    cyl: "",
    add: "",
    qty: "1",
    unitCost: "",
  };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function toInput(line: LineDraft): PurchaseLineInput {
  return {
    productId: line.productId,
    sph: num(line.sph),
    cyl: num(line.cyl),
    add: num(line.add),
    eye: line.eye === "" ? null : line.eye,
    qty: Number(line.qty) || 0,
    unitCost: num(line.unitCost),
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : "Save purchase and receive stock"}
    </Button>
  );
}

const cell =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-sm outline-none transition-colors disabled:bg-mist-100";

export function PurchaseForm({
  suppliers,
  products,
}: {
  suppliers: Supplier[];
  products: Product[];
}) {
  const [state, formAction] = useActionState<PurchaseFormState, FormData>(
    savePurchase,
    {},
  );
  const errors = state.fieldErrors;

  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  // Controlled so a failed save does not wipe the header: React resets
  // uncontrolled fields once a form action finishes.
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayInKarachi);
  const [notes, setNotes] = useState("");

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  function update(key: string, patch: Partial<LineDraft>) {
    setLines((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function pickProduct(key: string, productId: string) {
    const product = productById.get(productId);
    update(key, {
      productId,
      // What we usually pay, as a starting point — the invoice may differ.
      unitCost: product ? String(product.purchase_price) : "",
      ...(product?.tracks_power ? {} : { sph: "", cyl: "", add: "", eye: "" }),
    });
  }

  function duplicate(key: string) {
    setLines((rows) => {
      const i = rows.findIndex((r) => r.key === key);
      if (i < 0) return rows;
      const copy = { ...rows[i], key: nextKey() };
      return [...rows.slice(0, i + 1), copy, ...rows.slice(i + 1)];
    });
  }

  const cost = (line: LineDraft) => {
    const product = productById.get(line.productId);
    const unit =
      line.unitCost.trim() === ""
        ? (product?.purchase_price ?? 0)
        : Number(line.unitCost) || 0;
    return Math.round(unit * (Number(line.qty) || 0) * 100) / 100;
  };

  const filled = lines.filter((l) => l.productId !== "");
  const totalQty = filled.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const totalCost = filled.reduce((sum, l) => sum + cost(l), 0);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(filled.map(toInput))}
      />

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">Supplier invoice</h2>
        <p className="text-navy-500 mt-1 max-w-prose text-sm">
          Copy the header from the supplier&apos;s invoice. Entering the same
          supplier and invoice number again adds lines to the invoice already on
          file.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            name="supplierId"
            label="Supplier"
            required
            errors={errors?.supplierId}
          >
            {(p) => (
              <select
                {...p}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select a supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.city ? ` — ${s.city}` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            name="invoiceNo"
            label="Their invoice no."
            required
            errors={errors?.invoiceNo}
          >
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

          <Field
            name="invoiceDate"
            label="Invoice date"
            required
            errors={errors?.invoiceDate}
          >
            {(p) => (
              <input
                {...p}
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">Lines on the supplier invoice</caption>
            <thead>
              <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                <th scope="col" className="w-8 px-3 py-2.5 font-medium">
                  #
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Product
                </th>
                <th scope="col" className="w-16 px-2 py-2.5 font-medium">
                  Eye
                </th>
                <th scope="col" className="w-20 px-2 py-2.5 font-medium">
                  SPH
                </th>
                <th scope="col" className="w-20 px-2 py-2.5 font-medium">
                  CYL
                </th>
                <th scope="col" className="w-20 px-2 py-2.5 font-medium">
                  ADD
                </th>
                <th scope="col" className="w-16 px-2 py-2.5 font-medium">
                  Qty
                </th>
                <th scope="col" className="w-24 px-2 py-2.5 font-medium">
                  Unit cost
                </th>
                <th
                  scope="col"
                  className="w-24 px-3 py-2.5 text-right font-medium"
                >
                  Total
                </th>
                <th scope="col" className="w-20 px-2 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const product = productById.get(line.productId);
                const power = product?.tracks_power ?? false;
                const n = index + 1;

                return (
                  <tr
                    key={line.key}
                    className="border-t border-mist-200 align-top"
                  >
                    <td className="text-navy-400 px-3 py-2 text-xs">{n}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Product for line ${n}`}
                        className={cell}
                        value={line.productId}
                        onChange={(e) => pickProduct(line.key, e.target.value)}
                      >
                        <option value="">Select…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        aria-label={`Eye for line ${n}`}
                        className={cell}
                        value={line.eye}
                        disabled={!power}
                        onChange={(e) =>
                          update(line.key, {
                            eye: e.target.value as LineDraft["eye"],
                          })
                        }
                      >
                        <option value="">—</option>
                        <option value="R">R</option>
                        <option value="L">L</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`SPH for line ${n}`}
                        className={cell}
                        type="number"
                        step="0.25"
                        inputMode="decimal"
                        disabled={!power}
                        placeholder={
                          power ? sphPlaceholder(product?.lens_sign) : ""
                        }
                        value={line.sph}
                        onChange={(e) =>
                          update(line.key, { sph: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`CYL for line ${n}`}
                        className={cell}
                        type="number"
                        step="0.25"
                        inputMode="decimal"
                        disabled={!power}
                        placeholder={power ? "-0.50" : ""}
                        value={line.cyl}
                        onChange={(e) =>
                          update(line.key, { cyl: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`ADD for line ${n}`}
                        className={cell}
                        type="number"
                        step="0.25"
                        min={0}
                        inputMode="decimal"
                        disabled={!power}
                        placeholder={power ? "+1.50" : ""}
                        value={line.add}
                        onChange={(e) =>
                          update(line.key, { add: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Quantity for line ${n}`}
                        className={cell}
                        type="number"
                        step="1"
                        min={1}
                        inputMode="numeric"
                        value={line.qty}
                        onChange={(e) =>
                          update(line.key, { qty: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Unit cost for line ${n}`}
                        className={cell}
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(e) =>
                          update(line.key, { unitCost: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {line.productId ? formatAmount(cost(line)) : ""}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => duplicate(line.key)}
                          className="text-navy-400 hover:text-navy-600 rounded p-1.5 transition-colors hover:bg-mist-100"
                          title="Duplicate line"
                        >
                          <Copy className="size-4" aria-hidden />
                          <span className="sr-only">Duplicate line {n}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLines((rows) =>
                              rows.length === 1
                                ? rows
                                : rows.filter((r) => r.key !== line.key),
                            )
                          }
                          disabled={lines.length === 1}
                          className="text-navy-400 rounded p-1.5 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-30"
                          title="Remove line"
                        >
                          <Trash2 className="size-4" aria-hidden />
                          <span className="sr-only">Remove line {n}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-mist-200 px-5 py-4">
          <button
            type="button"
            onClick={() => setLines((rows) => [...rows, emptyLine()])}
            className="text-accent-600 hover:text-accent-700 inline-flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus className="size-4" aria-hidden />
            Add line
          </button>
          <p className="text-sm">
            <span className="text-navy-500">
              {totalQty} {totalQty === 1 ? "unit" : "units"} ·{" "}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              Rs {formatAmount(totalCost)}
            </span>
          </p>
        </div>
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <Field name="notes" label="Note" errors={errors?.notes}>
          {(p) => (
            <input
              {...p}
              type="text"
              placeholder="Courier, tracking no. …"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>
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
        <SubmitButton />
        <Link
          href="/shop/purchases"
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
