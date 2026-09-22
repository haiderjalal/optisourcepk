"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Copy, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatAmount } from "@/lib/format";
import type { Customer, Order, OrderLine, Product } from "@/types/database";
import { saveOrder, type OrderFormState } from "./actions";

/**
 * Build an order line by line.
 *
 * Each eye is its own line, matching the printed invoice — the R/L buttons add
 * a matched pair in one click, because that is how a prescription arrives.
 * Totals are computed here for immediate feedback, but the figures that end up
 * on the invoice are recomputed by the database from the stored lines; nothing
 * a browser sends is trusted as money.
 */

interface LineDraft {
  key: string;
  productId: string;
  orderRef: string;
  eye: "" | "R" | "L";
  sph: string;
  cyl: string;
  ax: string;
  addPower: string;
  unitPrice: string;
  discountPct: string;
  quantity: string;
}

let seq = 0;
const nextKey = () => `line-${++seq}`;

function emptyLine(discount: number): LineDraft {
  return {
    key: nextKey(),
    productId: "",
    orderRef: "",
    eye: "",
    sph: "",
    cyl: "",
    ax: "",
    addPower: "",
    unitPrice: "",
    discountPct: String(discount),
    quantity: "1",
  };
}

function fromExisting(line: OrderLine): LineDraft {
  const text = (v: number | null) => (v === null ? "" : String(v));
  return {
    key: nextKey(),
    productId: line.product_id,
    orderRef: line.order_ref ?? "",
    eye: line.eye ?? "",
    sph: text(line.sph),
    cyl: text(line.cyl),
    ax: text(line.ax),
    addPower: text(line.add_power),
    unitPrice: String(line.unit_price),
    discountPct: String(line.discount_pct),
    quantity: String(line.quantity),
  };
}

function lineTotal(line: LineDraft): number {
  const price = Number(line.unitPrice) || 0;
  const qty = Number(line.quantity) || 0;
  const discount = Number(line.discountPct) || 0;
  const gross = Math.round(price * qty * 100) / 100;
  return gross - Math.round(((gross * discount) / 100) * 100) / 100;
}

function SubmitButton({ isUpdate }: { isUpdate: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : isUpdate ? "Save order" : "Create order"}
    </Button>
  );
}

const cell =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-sm outline-none transition-colors";

export function OrderBuilder({
  customers,
  products,
  order,
  lines: existing,
}: {
  customers: Customer[];
  products: Product[];
  order?: Order;
  lines?: OrderLine[];
}) {
  const [state, formAction] = useActionState<OrderFormState, FormData>(
    saveOrder,
    {},
  );

  const [customerId, setCustomerId] = useState(
    order?.bill_to_customer_id ?? "",
  );
  const [lines, setLines] = useState<LineDraft[]>(
    existing && existing.length > 0
      ? existing.map(fromExisting)
      : [emptyLine(0)],
  );

  const customer = customers.find((c) => c.id === customerId);
  const defaultDiscount = customer?.default_discount_pct ?? 0;

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  function update(key: string, patch: Partial<LineDraft>) {
    setLines((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  /** Picking a product fills in its rate and the customer's standing discount. */
  function pickProduct(key: string, productId: string) {
    const product = productById.get(productId);
    update(key, {
      productId,
      unitPrice: product ? String(product.list_price) : "",
      discountPct: String(defaultDiscount),
    });
  }

  /** A prescription is two eyes; adding them as a pair saves re-typing. */
  function addPair() {
    const base = emptyLine(defaultDiscount);
    setLines((rows) => [
      ...rows,
      { ...base, eye: "R" },
      { ...base, key: nextKey(), eye: "L" },
    ]);
  }

  /** Copy a line — the second eye usually differs by one value. */
  function duplicate(key: string) {
    setLines((rows) => {
      const index = rows.findIndex((r) => r.key === key);
      if (index < 0) return rows;
      const copy = {
        ...rows[index],
        key: nextKey(),
        eye: rows[index].eye === "R" ? ("L" as const) : rows[index].eye,
      };
      return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const lensCount = lines.reduce((sum, line) => {
    const product = productById.get(line.productId);
    return product?.tracks_power ? sum + (Number(line.quantity) || 0) : sum;
  }, 0);

  // What the server actually validates. Blank strings become nulls there.
  const payload = lines.map((line) => ({
    productId: line.productId,
    orderRef: line.orderRef,
    eye: line.eye,
    sph: line.sph,
    cyl: line.cyl,
    ax: line.ax,
    addPower: line.addPower,
    unitPrice: line.unitPrice || "0",
    discountPct: line.discountPct || "0",
    quantity: line.quantity || "0",
  }));

  return (
    <form action={formAction} className="space-y-5">
      {order && <input type="hidden" name="id" value={order.id} />}
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <section className="shadow-lift rounded-2xl bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            name="customerId"
            label="Customer"
            required
            className="lg:col-span-2"
            errors={state.fieldErrors?.customerId}
          >
            {(p) => (
              <select
                {...p}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select a shop…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shop_name} — {c.area}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field name="externalOrderRef" label="Order no.">
            {(p) => (
              <input
                {...p}
                type="text"
                defaultValue={order?.external_order_ref ?? ""}
                placeholder="Their reference"
              />
            )}
          </Field>

          <Field name="priority" label="Priority">
            {(p) => (
              <select {...p} defaultValue={order?.priority ?? "normal"}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            )}
          </Field>
        </div>

        {customer && defaultDiscount > 0 && (
          <p className="text-navy-500 mt-3 text-xs">
            {customer.shop_name} has a standing discount of {defaultDiscount}%.
            It pre-fills each line and can be changed per line.
          </p>
        )}
      </section>

      <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-200 px-5 py-4">
          <h2 className="text-base font-semibold">Lines</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addPair}>
              <Plus className="size-4" aria-hidden />
              Add R + L pair
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((rows) => [...rows, emptyLine(defaultDiscount)])
              }
            >
              <Plus className="size-4" aria-hidden />
              Add line
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
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
                <th scope="col" className="w-16 px-2 py-2.5 font-medium">
                  AX
                </th>
                <th scope="col" className="w-20 px-2 py-2.5 font-medium">
                  ADD
                </th>
                <th scope="col" className="w-24 px-2 py-2.5 font-medium">
                  Rate
                </th>
                <th scope="col" className="w-20 px-2 py-2.5 font-medium">
                  Disc %
                </th>
                <th scope="col" className="w-16 px-2 py-2.5 font-medium">
                  Qty
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

                return (
                  <tr
                    key={line.key}
                    className="border-t border-mist-200 align-top"
                  >
                    <td className="text-navy-400 px-3 py-2 text-xs">
                      {index + 1}
                    </td>

                    <td className="px-3 py-2">
                      <select
                        aria-label={`Product for line ${index + 1}`}
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
                        aria-label={`Eye for line ${index + 1}`}
                        className={cell}
                        value={line.eye}
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

                    {/* Powers stay editable on every line: a coating billed
                        against a prescription may still carry them. */}
                    <td className="px-2 py-2">
                      <input
                        aria-label={`SPH for line ${index + 1}`}
                        className={cell}
                        type="number"
                        step="0.25"
                        inputMode="decimal"
                        placeholder={power ? "-2.00" : ""}
                        value={line.sph}
                        onChange={(e) =>
                          update(line.key, { sph: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`CYL for line ${index + 1}`}
                        className={cell}
                        type="number"
                        step="0.25"
                        inputMode="decimal"
                        value={line.cyl}
                        onChange={(e) =>
                          update(line.key, { cyl: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`AX for line ${index + 1}`}
                        className={cell}
                        type="number"
                        step="1"
                        min={0}
                        max={180}
                        inputMode="numeric"
                        value={line.ax}
                        onChange={(e) =>
                          update(line.key, { ax: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`ADD for line ${index + 1}`}
                        className={cell}
                        type="number"
                        step="0.25"
                        inputMode="decimal"
                        value={line.addPower}
                        onChange={(e) =>
                          update(line.key, { addPower: e.target.value })
                        }
                      />
                    </td>

                    <td className="px-2 py-2">
                      <input
                        aria-label={`Rate for line ${index + 1}`}
                        className={cell}
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(e) =>
                          update(line.key, { unitPrice: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Discount for line ${index + 1}`}
                        className={cell}
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        inputMode="decimal"
                        value={line.discountPct}
                        onChange={(e) =>
                          update(line.key, { discountPct: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Quantity for line ${index + 1}`}
                        className={cell}
                        type="number"
                        step="1"
                        min={1}
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) =>
                          update(line.key, { quantity: e.target.value })
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatAmount(lineTotal(line))}
                    </td>

                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => duplicate(line.key)}
                          className="text-navy-400 hover:text-navy-600 rounded p-1.5 transition-colors hover:bg-mist-100"
                          title="Duplicate line"
                        >
                          <Copy className="size-4" aria-hidden />
                          <span className="sr-only">
                            Duplicate line {index + 1}
                          </span>
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
                          <span className="sr-only">
                            Remove line {index + 1}
                          </span>
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
          <p className="text-navy-500 text-sm">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
            {lensCount > 0 && ` · ${lensCount} lenses`}
          </p>
          <p className="text-sm">
            <span className="text-navy-500">Subtotal </span>
            <span className="text-lg font-semibold tabular-nums">
              Rs {formatAmount(subtotal)}
            </span>
          </p>
        </div>
      </section>

      <details className="shadow-lift rounded-2xl bg-white p-5">
        <summary className="cursor-pointer text-base font-semibold">
          Delivery and notes
          <span className="text-navy-400 ml-2 text-xs font-normal">
            optional
          </span>
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="deliverToName" label="Deliver to (if different)">
            {(p) => (
              <input
                {...p}
                type="text"
                defaultValue={order?.deliver_to_name ?? ""}
              />
            )}
          </Field>
          <Field name="deliverToArea" label="Delivery area">
            {(p) => (
              <input
                {...p}
                type="text"
                defaultValue={order?.deliver_to_area ?? ""}
              />
            )}
          </Field>
          <Field
            name="deliverToAddress"
            label="Delivery address"
            className="sm:col-span-2"
          >
            {(p) => (
              <textarea
                {...p}
                rows={2}
                defaultValue={order?.deliver_to_address ?? ""}
              />
            )}
          </Field>
          <Field name="courierName" label="Courier">
            {(p) => (
              <input
                {...p}
                type="text"
                defaultValue={order?.courier_name ?? ""}
              />
            )}
          </Field>
          <Field name="trackingNo" label="Tracking no.">
            {(p) => (
              <input
                {...p}
                type="text"
                defaultValue={order?.tracking_no ?? ""}
              />
            )}
          </Field>
          <Field name="notes" label="Notes" className="sm:col-span-2">
            {(p) => (
              <textarea {...p} rows={2} defaultValue={order?.notes ?? ""} />
            )}
          </Field>
        </div>
      </details>

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
        <SubmitButton isUpdate={Boolean(order)} />
        <Link
          href="/shop/orders"
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
        <span className="text-navy-400 text-xs">
          Saving creates a draft. Stock moves only when you issue the invoice.
        </span>
      </div>
    </form>
  );
}
