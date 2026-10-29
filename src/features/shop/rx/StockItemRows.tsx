"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { OrderLine, Product } from "@/types/database";

/**
 * Stock items on an RX order or a reopened RX invoice: shelf products billed
 * with the lenses. They are not sent to the lab, and carry no lab status.
 */

export interface StockRowDraft {
  key: string;
  productId: string;
  eye: "" | "R" | "L";
  sph: string;
  cyl: string;
  ax: string;
  add: string;
  quantity: string;
  rate: string;
  /** Blank means the form's discount applies. */
  discount: string;
}

export const cell =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-center font-mono text-sm outline-none transition-colors";

const selectClass =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-sm outline-none transition-colors";

export function blankStockRow(): StockRowDraft {
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
    discount: "",
  };
}

/** The stock items already on an order: its lines with no lab status. */
export function stockRowsFrom(lines: OrderLine[]): StockRowDraft[] {
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
      discount: String(line.discount_pct),
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

/** The first reason the stock items cannot be saved, or null when they all can. */
export function firstStockProblem(
  rows: StockRowDraft[],
  stockProducts: Product[],
): string | null {
  const byId = new Map(stockProducts.map((p) => [p.id, p]));
  for (const row of rows) {
    const problem = stockRowProblem(row, byId.get(row.productId));
    if (problem) return problem;
  }
  return null;
}

/** The stock items as the order form posts them: one line each, normal stock. */
export function stockItemLines(
  rows: StockRowDraft[],
  fallbackDiscount: string,
) {
  return rows.map((row) => ({
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
    discountPct: row.discount || fallbackDiscount,
    quantity: row.quantity,
    unitCost: "",
    supplierId: "",
  }));
}

export function StockItemRows({
  rows,
  onChange,
  stockProducts,
  fallbackDiscount,
}: {
  rows: StockRowDraft[];
  onChange: (rows: StockRowDraft[]) => void;
  stockProducts: Product[];
  /** Shown as the blank discount, and used for a row left blank. */
  fallbackDiscount: string;
}) {
  const stockById = useMemo(
    () => new Map(stockProducts.map((p) => [p.id, p])),
    [stockProducts],
  );

  function update(key: string, patch: Partial<StockRowDraft>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function remove(key: string) {
    onChange(rows.filter((row) => row.key !== key));
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const product = stockById.get(row.productId);
          return (
            <div key={row.key} className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs">
                <span className="text-navy-500">Product</span>
                <select
                  className={selectClass}
                  value={row.productId}
                  onChange={(e) => {
                    const picked = stockById.get(e.target.value);
                    update(row.key, {
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
                      className={selectClass}
                      value={row.eye}
                      onChange={(e) =>
                        update(row.key, {
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
                          update(row.key, { [key]: e.target.value })
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
                    update(row.key, { quantity: e.target.value })
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
                  onChange={(e) => update(row.key, { rate: e.target.value })}
                />
              </label>
              <label className="flex w-20 flex-col gap-1 text-xs">
                <span className="text-navy-500">Disc %</span>
                <input
                  className={cell}
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  placeholder={fallbackDiscount}
                  value={row.discount}
                  onChange={(e) =>
                    update(row.key, { discount: e.target.value })
                  }
                />
              </label>

              <button
                type="button"
                onClick={() => remove(row.key)}
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
        onClick={() => onChange([...rows, blankStockRow()])}
        className="text-accent-700 hover:text-accent-800 mt-3 inline-flex items-center gap-1 text-sm font-medium"
      >
        <Plus className="size-4" aria-hidden />
        Add stock item
      </button>
    </>
  );
}
