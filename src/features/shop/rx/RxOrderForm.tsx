"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatAmount } from "@/lib/format";
import type {
  Customer,
  Order,
  OrderLine,
  Product,
  Supplier,
} from "@/types/database";
import { saveOrder, type OrderFormState } from "../orders/actions";

/**
 * The RX job card: one patient, one pair of lenses, as on the paper form.
 *
 * It posts the same order the line builder does — an R line and an L line,
 * flagged RX — so saving, invoicing and the ledger are unchanged. An eye with
 * nothing typed is not ordered; type 0 in SPH for a plano lens.
 */

type EyeKey = "R" | "L";

interface EyeDraft {
  sph: string;
  cyl: string;
  ax: string;
  add: string;
  /** Fitting details, passed to the lab as typed. */
  dia: string;
  base: string;
  fittingHeight: string;
  prism: string;
  ipd: string;
}

const EMPTY_EYE: EyeDraft = {
  sph: "",
  cyl: "",
  ax: "",
  add: "",
  dia: "",
  base: "",
  fittingHeight: "",
  prism: "",
  ipd: "",
};

/** The fitting columns, each its own field. */
const FITTING = [
  ["dia", "Dia"],
  ["fittingHeight", "Fitting height"],
  ["base", "Base"],
  ["prism", "Prism"],
  ["ipd", "IPD"],
] as const;

const LENS_TYPES = [
  { value: "sv", label: "SV" },
  { value: "kry", label: "KRY" },
  { value: "dbf", label: "DBF" },
  { value: "prog", label: "PROG" },
  { value: "blended", label: "Blended" },
] as const;

const MATERIALS = [
  { value: "plastic", label: "Plastic" },
  { value: "metal", label: "Metal" },
] as const;

const FRAME_TYPES = [
  { value: "rimmed", label: "Rimmed" },
  { value: "half", label: "Half" },
  { value: "rimless", label: "Rimless" },
] as const;

const cell =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-center font-mono text-sm outline-none transition-colors";

function eyeFrom(line: OrderLine | undefined): EyeDraft {
  if (!line) return EMPTY_EYE;
  const text = (v: number | null) => (v === null ? "" : String(v));
  return {
    sph: text(line.sph),
    cyl: text(line.cyl),
    ax: text(line.ax),
    add: text(line.add_power),
    dia: line.rx_dia ?? "",
    base: line.rx_base ?? "",
    fittingHeight: line.rx_fitting_height ?? "",
    prism: line.rx_prism ?? "",
    ipd: line.rx_ipd ?? "",
  };
}

const typed = (eye: EyeDraft) =>
  eye.sph !== "" || eye.cyl !== "" || eye.ax !== "" || eye.add !== "";

/** A stock item billed with the lenses: a shelf product, not sent to the lab. */
interface StockRowDraft {
  key: string;
  productId: string;
  eye: "" | "R" | "L";
  sph: string;
  cyl: string;
  ax: string;
  add: string;
  quantity: string;
  rate: string;
}

const field =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-sm outline-none transition-colors";

function blankStockRow(): StockRowDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    eye: "",
    sph: "",
    cyl: "",
    ax: "",
    add: "",
    quantity: "1",
    rate: "",
  };
}

/** The stock items already on an order being edited: its lines with no lab status. */
function stockRowsFrom(lines: OrderLine[]): StockRowDraft[] {
  const text = (v: number | null) => (v === null ? "" : String(v));
  return lines
    .filter((line) => line.rx_status === null)
    .map((line) => ({
      key: line.id,
      productId: line.product_id ?? "",
      eye: line.eye === "R" || line.eye === "L" ? line.eye : "",
      sph: text(line.sph),
      cyl: text(line.cyl),
      ax: text(line.ax),
      add: text(line.add_power),
      quantity: String(line.quantity),
      rate: String(line.unit_price),
    }));
}

/** Why a stock item cannot be saved yet, or null when it can. */
function stockRowProblem(
  row: StockRowDraft,
  product: Product | undefined,
): string | null {
  if (!product) {
    return "Pick a product for each stock item, or remove the empty one.";
  }
  const quantity = Number(row.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return `Enter a whole-number quantity for ${product.name}.`;
  }
  if (product.tracks_power && row.sph === "") {
    return `Enter the sphere for ${product.name}.`;
  }
  return null;
}

function SubmitButton({
  isUpdate,
  ready,
}: {
  isUpdate: boolean;
  ready: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending || !ready}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : isUpdate ? "Save RX order" : "Book RX order"}
    </Button>
  );
}

export function RxOrderForm({
  customers,
  products,
  stockProducts,
  suppliers,
  order,
  lines = [],
}: {
  customers: Customer[];
  products: Product[];
  /** Shelf products that can go on the order as stock items. */
  stockProducts: Product[];
  suppliers: Supplier[];
  order?: Order;
  lines?: OrderLine[];
}) {
  const [state, formAction] = useActionState<OrderFormState, FormData>(
    saveOrder,
    {},
  );

  // The lens lines carry a lab status; any other line on the order is a stock item.
  const rxLines = lines.filter((line) => line.rx_status !== null);
  const first = rxLines[0];
  const [customerId, setCustomerId] = useState(
    order?.bill_to_customer_id ?? "",
  );
  const [eyes, setEyes] = useState<Record<EyeKey, EyeDraft>>({
    R: eyeFrom(rxLines.find((l) => l.eye === "R")),
    L: eyeFrom(rxLines.find((l) => l.eye === "L")),
  });
  const [stockRows, setStockRows] = useState<StockRowDraft[]>(() =>
    stockRowsFrom(lines),
  );
  const [product, setProduct] = useState(first?.product_name ?? "");
  const [rate, setRate] = useState(first ? String(first.unit_price) : "");
  const [cost, setCost] = useState(
    first?.unit_cost === null || first?.unit_cost === undefined
      ? ""
      : String(first.unit_cost),
  );
  const [supplierId, setSupplierId] = useState(first?.supplier_id ?? "");
  const customer = customers.find((c) => c.id === customerId);
  const [discount, setDiscount] = useState(
    first ? String(first.discount_pct) : "",
  );
  const [quantity, setQuantity] = useState(
    first ? String(first.quantity) : "1",
  );
  // The shop's standing discount applies until one is typed.
  const discountPct =
    discount !== "" ? discount : String(customer?.default_discount_pct ?? 0);

  const rxNames = useMemo(
    () =>
      [...new Set(products.filter((p) => p.is_rx).map((p) => p.name))].sort(),
    [products],
  );

  const ordered = (["R", "L"] as const).filter((eye) => typed(eyes[eye]));
  // The lab quotes once the lens is made, so prices are asked for only then.
  const pricing = order?.rx_stage === "back";
  const quantityValue = Number(quantity) || 0;
  const quantityValid =
    Number.isInteger(quantityValue) &&
    quantityValue >= 1 &&
    quantityValue <= 100_000;
  const perLens = (Number(rate) || 0) * (1 - (Number(discountPct) || 0) / 100);
  const lensCount = ordered.length * quantityValue;
  const total = Math.round(perLens * lensCount * 100) / 100;

  // What the server validates: one line per eye ordered, then the stock items.
  const rxPayload = ordered.map((eye) => ({
    productId: "",
    productName: product,
    orderRef: "",
    eye,
    sph: eyes[eye].sph,
    cyl: eyes[eye].cyl,
    ax: eyes[eye].ax,
    addPower: eyes[eye].add,
    rxDia: eyes[eye].dia,
    rxBase: eyes[eye].base,
    rxFittingHeight: eyes[eye].fittingHeight,
    rxPrism: eyes[eye].prism,
    rxIpd: eyes[eye].ipd,
    // Blank until the lab has quoted; the invoice cannot be issued at 0.
    unitPrice: rate || "0",
    discountPct,
    quantity,
    unitCost: cost,
    supplierId,
  }));

  const stockById = useMemo(
    () => new Map(stockProducts.map((p) => [p.id, p])),
    [stockProducts],
  );
  const stockProblem =
    stockRows
      .map((row) => stockRowProblem(row, stockById.get(row.productId)))
      .find((problem) => problem !== null) ?? null;
  // Stock items are billed on the same invoice, at their own quantity and rate.
  const stockPayload = stockRows.map((row) => ({
    productId: row.productId,
    productName: "",
    orderRef: "",
    stockSource: "normal" as const,
    eye: row.eye,
    sph: row.sph,
    cyl: row.cyl,
    ax: row.ax,
    addPower: row.add,
    rxDia: "",
    rxBase: "",
    rxFittingHeight: "",
    rxPrism: "",
    rxIpd: "",
    unitPrice: row.rate || "0",
    discountPct,
    quantity: row.quantity,
    unitCost: "",
    supplierId: "",
  }));
  const payload = [...rxPayload, ...stockPayload];

  function setEye(eye: EyeKey, patch: Partial<EyeDraft>) {
    setEyes((current) => ({
      ...current,
      [eye]: { ...current[eye], ...patch },
    }));
  }

  function addStockRow() {
    setStockRows((rows) => [...rows, blankStockRow()]);
  }

  function updateStockRow(key: string, patch: Partial<StockRowDraft>) {
    setStockRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeStockRow(key: string) {
    setStockRows((rows) => rows.filter((row) => row.key !== key));
  }

  return (
    <form action={formAction} className="space-y-5">
      {order && <input type="hidden" name="id" value={order.id} />}
      <input type="hidden" name="isRx" value="true" />
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="customerId"
            label="Bill To"
            required
            hint="The customer account and shop that will receive the invoice."
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
                    {c.shop_name} — {c.customer_name}
                    {c.area ? ` · ${c.area}` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            name="patientName"
            label="Patient name"
            hint="Optional. This is separate from Bill To."
            errors={state.fieldErrors?.patientName}
          >
            {(p) => (
              <input
                {...p}
                type="text"
                maxLength={120}
                defaultValue={order?.patient_name ?? ""}
              />
            )}
          </Field>
          <Field
            name="orderByName"
            label="Optician name"
            hint="Optional. The person who placed the order."
          >
            {(p) => (
              <input
                {...p}
                type="text"
                maxLength={120}
                defaultValue={order?.order_by_name ?? ""}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">Lens details</h2>

        <fieldset className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <legend className="text-navy-600 float-left mr-3 text-sm font-medium">
            New Rx
          </legend>
          <Choices
            name="rxLensType"
            options={LENS_TYPES}
            defaultValue={order?.rx_lens_type ?? ""}
          />
        </fieldset>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full max-w-2xl text-sm">
            <caption className="sr-only">Prescription for each eye</caption>
            <thead>
              <tr className="text-navy-600 bg-mist-100 text-xs">
                <th scope="col" className="w-20 px-3 py-2 text-left">
                  Eye
                </th>
                <th scope="col" className="px-2 py-2">
                  Sphere
                </th>
                <th scope="col" className="px-2 py-2">
                  Cyl
                </th>
                <th scope="col" className="px-2 py-2">
                  Axis
                </th>
                <th scope="col" className="px-2 py-2">
                  Add
                </th>
              </tr>
            </thead>
            <tbody>
              {(["R", "L"] as const).map((eye) => (
                <tr key={eye} className="border-t border-mist-200">
                  <th
                    scope="row"
                    className="text-navy-700 px-3 py-2 text-left font-medium"
                  >
                    {eye}.E
                  </th>
                  {(
                    [
                      ["sph", "Sphere", "0.25", undefined, undefined],
                      ["cyl", "Cyl", "0.25", undefined, undefined],
                      ["ax", "Axis", "1", 0, 180],
                      ["add", "Add", "0.25", 0, 6],
                    ] as const
                  ).map(([key, label, step, min, max]) => (
                    <td key={key} className="px-2 py-2">
                      <input
                        aria-label={`${label}, ${eye === "R" ? "right" : "left"} eye`}
                        className={cell}
                        type="number"
                        step={step}
                        min={min}
                        max={max}
                        inputMode="decimal"
                        value={eyes[eye][key]}
                        onChange={(e) => setEye(eye, { [key]: e.target.value })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-navy-400 mt-2 text-xs">
          Leave an eye blank if it is not being made. Type 0 in Sphere for a
          plano lens.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full max-w-3xl text-sm">
            <caption className="text-navy-600 mb-2 text-left text-sm font-medium">
              Fitting details
              <span className="text-navy-400 ml-2 text-xs font-normal">
                optional, sent to the lab as typed
              </span>
            </caption>
            <thead>
              <tr className="text-navy-600 bg-mist-100 text-xs">
                <th scope="col" className="w-20 px-3 py-2 text-left">
                  Eye
                </th>
                {FITTING.map(([key, label]) => (
                  <th key={key} scope="col" className="px-2 py-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["R", "L"] as const).map((eye) => (
                <tr key={eye} className="border-t border-mist-200">
                  <th
                    scope="row"
                    className="text-navy-700 px-3 py-2 text-left font-medium"
                  >
                    {eye}.E
                  </th>
                  {FITTING.map(([key, label]) => (
                    <td key={key} className="px-2 py-2">
                      <input
                        aria-label={`${label}, ${eye === "R" ? "right" : "left"} eye`}
                        className={cell}
                        type="text"
                        maxLength={20}
                        value={eyes[eye][key]}
                        onChange={(e) => setEye(eye, { [key]: e.target.value })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Field
          name="productName"
          label="Full description of lenses given (brand, index, photo, MAR)"
          required
          className="mt-5"
          hint="A description you have not used before is saved as a product for next time."
        >
          {(p) => (
            <input
              {...p}
              type="text"
              list="rx-product-names"
              maxLength={120}
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            />
          )}
        </Field>
        <datalist id="rx-product-names">
          {rxNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <Field
          name="rxTintReason"
          label="Specific reason for giving tint, photochromatic or antiglare"
          className="mt-4"
        >
          {(p) => (
            <textarea
              {...p}
              rows={2}
              maxLength={400}
              defaultValue={order?.rx_tint_reason ?? ""}
            />
          )}
        </Field>
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">New frame make</h2>
        <fieldset className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <legend className="sr-only">Frame material</legend>
          <Choices
            name="frameMaterial"
            options={MATERIALS}
            defaultValue={order?.frame_material ?? ""}
          />
        </fieldset>
        <fieldset className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          <legend className="sr-only">Frame type</legend>
          <Choices
            name="frameType"
            options={FRAME_TYPES}
            defaultValue={order?.frame_type ?? ""}
          />
        </fieldset>
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">
          {pricing ? "Lab and prices" : "Lab"}
        </h2>
        {!pricing && (
          <input
            type="hidden"
            name="labOrderNo"
            value={order?.lab_order_no ?? ""}
          />
        )}
        <p className="text-navy-500 mt-1 text-xs">
          {pricing
            ? "Per lens. The lab's price and the sale price, before you issue the invoice."
            : "Prices are added once the lens is back from the lab."}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field name="rxSupplierId" label="Lab">
            {(p) => (
              <select
                {...p}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Not chosen</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field name="rxQuantity" label="Quantity per eye">
            {(p) => (
              <input
                {...p}
                type="number"
                step="1"
                min={1}
                max={100000}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            )}
          </Field>
          <Field name="rxDiscount" label="Discount %">
            {(p) => (
              <input
                {...p}
                type="number"
                step="0.01"
                min={0}
                max={100}
                inputMode="decimal"
                value={discountPct}
                onChange={(e) => setDiscount(e.target.value)}
              />
            )}
          </Field>
          {pricing && (
            <>
              <Field
                name="labOrderNo"
                label="Lab order number"
                hint="Optional. Enter it when the pair is received."
                errors={state.fieldErrors?.labOrderNo}
              >
                {(p) => (
                  <input
                    {...p}
                    type="text"
                    maxLength={80}
                    defaultValue={order?.lab_order_no ?? ""}
                  />
                )}
              </Field>
              <Field name="rxCost" label="Purchase price" hint="Not printed.">
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                )}
              </Field>
              <Field name="rxRate" label="Sale price" required>
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                )}
              </Field>
            </>
          )}
        </div>
        {pricing && (
          <p className="mt-4 text-right text-sm">
            <span className="text-navy-500">
              {lensCount} {lensCount === 1 ? "lens" : "lenses"} · Total{" "}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              Rs {formatAmount(total)}
            </span>
          </p>
        )}
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">
          Stock items for this patient
        </h2>
        <p className="text-navy-500 mt-1 text-xs">
          Optional. Shelf items billed on the same invoice as the lenses. They
          are not sent to the lab.
        </p>

        <div className="mt-4 space-y-3">
          {stockRows.map((row) => {
            const product = stockById.get(row.productId);
            return (
              <div key={row.key} className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs">
                  <span className="text-navy-500">Product</span>
                  <select
                    className={field}
                    value={row.productId}
                    onChange={(e) => {
                      const picked = stockById.get(e.target.value);
                      updateStockRow(row.key, {
                        productId: e.target.value,
                        rate: picked ? String(picked.list_price) : "",
                      });
                    }}
                  >
                    <option value="">Choose a product…</option>
                    {stockProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                {product?.tracks_power && (
                  <>
                    <label className="flex w-20 flex-col gap-1 text-xs">
                      <span className="text-navy-500">Eye</span>
                      <select
                        className={field}
                        value={row.eye}
                        onChange={(e) =>
                          updateStockRow(row.key, {
                            eye: e.target.value as StockRowDraft["eye"],
                          })
                        }
                      >
                        <option value="">—</option>
                        <option value="R">R</option>
                        <option value="L">L</option>
                      </select>
                    </label>
                    {(
                      [
                        ["sph", "Sphere"],
                        ["cyl", "Cyl"],
                        ["ax", "Axis"],
                        ["add", "Add"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex w-20 flex-col gap-1 text-xs"
                      >
                        <span className="text-navy-500">{label}</span>
                        <input
                          className={cell}
                          type="number"
                          step={key === "ax" ? "1" : "0.25"}
                          inputMode="decimal"
                          value={row[key]}
                          onChange={(e) =>
                            updateStockRow(row.key, { [key]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  </>
                )}

                <label className="flex w-20 flex-col gap-1 text-xs">
                  <span className="text-navy-500">Qty</span>
                  <input
                    className={cell}
                    type="number"
                    step="1"
                    min={1}
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) =>
                      updateStockRow(row.key, { quantity: e.target.value })
                    }
                  />
                </label>
                <label className="flex w-28 flex-col gap-1 text-xs">
                  <span className="text-navy-500">Rate</span>
                  <input
                    className={cell}
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    value={row.rate}
                    onChange={(e) =>
                      updateStockRow(row.key, { rate: e.target.value })
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeStockRow(row.key)}
                  aria-label="Remove stock item"
                  className="text-navy-300 rounded-md p-2 transition-colors hover:bg-amber-50 hover:text-amber-700"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addStockRow}
          className="text-accent-700 hover:text-accent-800 mt-3 inline-flex items-center gap-1 text-sm font-medium"
        >
          <Plus className="size-4" aria-hidden />
          Add stock item
        </button>
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <Field
          name="notes"
          label="Notes"
          hint="Anything about this job. Sent to the lab in the WhatsApp order; not printed on the invoice."
        >
          {(p) => (
            <textarea
              {...p}
              rows={3}
              maxLength={2000}
              defaultValue={order?.notes ?? ""}
            />
          )}
        </Field>
      </section>

      <details className="shadow-lift rounded-2xl bg-white p-5">
        <summary className="cursor-pointer text-base font-semibold">
          Reference and priority
          <span className="text-navy-400 ml-2 text-xs font-normal">
            optional
          </span>
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="externalOrderRef" label="Optician's order no.">
            {(p) => (
              <input
                {...p}
                type="text"
                defaultValue={order?.external_order_ref ?? ""}
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
        <SubmitButton
          isUpdate={Boolean(order)}
          ready={ordered.length > 0 && quantityValid && stockProblem === null}
        />
        <Link
          href={order ? `/shop/orders/${order.id}` : "/shop/rx"}
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
        <span className="text-navy-400 text-xs">
          {ordered.length === 0
            ? "Enter the power for at least one eye to book it."
            : !quantityValid
              ? "Enter a whole-number quantity of at least 1."
              : stockProblem !== null
                ? stockProblem
                : stockRows.length > 0
                  ? "Gets the next RX number when booked. Stock items come off the shelf when the invoice is issued."
                  : "Gets the next RX number when booked. No stock is checked or deducted."}
        </span>
      </div>
    </form>
  );
}

/** A row of radio choices that reads like the tick boxes on the paper form. */
function Choices({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <>
      {options.map((option) => (
        <label
          key={option.value}
          className="text-navy-700 inline-flex items-center gap-2 text-sm"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={defaultValue === option.value}
            className="size-4"
          />
          {option.label}
        </label>
      ))}
    </>
  );
}
