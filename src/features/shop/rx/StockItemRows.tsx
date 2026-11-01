"use client";

import { useMemo } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/format";
import { sphPlaceholder } from "@/lib/power";
import type { OrderLine, Product } from "@/types/database";
import { lineAmount, lineCell } from "../orders/lineTable";

/**
 * Stock items on an RX order or a reopened RX invoice: shelf products billed
 * with the lenses, in the same lines table as a stock order. Each item comes
 * from normal stock or from the daily register. They are not sent to the lab,
 * and carry no lab status.
 */

export interface StockRowDraft {
  key: string;
  productId: string;
  stockSource: "normal" | "daily";
  eye: "" | "R" | "L";
  sph: string;
  cyl: string;
  ax: string;
  add: string;
  quantity: string;
  rate: string;
  /** Blank means the form's discount applies. */
  discount: string;
  /** Daily items only: what one unit cost us. */
  unitCost: string;
}

/** A centred figure in the RX job card's prescription grid. */
export const cell =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-center font-mono text-sm outline-none transition-colors";

export function blankStockRow(eye: StockRowDraft["eye"] = ""): StockRowDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    stockSource: "normal",
    eye,
    sph: "",
    cyl: "",
    ax: "",
    add: "",
    quantity: "1",
    rate: "",
    discount: "",
    unitCost: "",
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
      stockSource: line.stock_source,
      eye: line.eye === "R" || line.eye === "L" ? line.eye : "",
      sph: text(line.sph),
      cyl: text(line.cyl),
      ax: text(line.ax),
      add: text(line.add_power),
      quantity: String(line.quantity),
      rate: String(line.unit_price),
      discount: String(line.discount_pct),
      unitCost: text(line.unit_cost),
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

/** The stock items as the order form posts them: one line each. */
export function stockItemLines(
  rows: StockRowDraft[],
  fallbackDiscount: string,
) {
  return rows.map((row) => ({
    productId: row.productId,
    productName: "",
    orderRef: "",
    stockSource: row.stockSource,
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
    unitCost: row.stockSource === "daily" ? row.unitCost : "",
    supplierId: "",
  }));
}

/** A daily item starts from the product's usual cost; it can be changed. */
function dailyCost(product: Product | undefined): string {
  return product && product.purchase_price > 0
    ? String(product.purchase_price)
    : "";
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

  /** Picking a product fills in its rate; a service always comes from normal stock. */
  function pickProduct(key: string, productId: string) {
    const product = stockById.get(productId);
    const row = rows.find((r) => r.key === key);
    const stockSource =
      product?.category === "services"
        ? "normal"
        : (row?.stockSource ?? "normal");
    update(key, {
      productId,
      stockSource,
      rate: product ? String(product.list_price) : "",
      unitCost: stockSource === "daily" ? dailyCost(product) : "",
    });
  }

  function pickStockSource(
    key: string,
    stockSource: StockRowDraft["stockSource"],
  ) {
    const row = rows.find((r) => r.key === key);
    const product = row ? stockById.get(row.productId) : undefined;
    update(key, {
      stockSource,
      unitCost: stockSource === "daily" ? dailyCost(product) : "",
    });
  }

  /** Copy an item — the second eye usually differs by one value. */
  function duplicate(key: string) {
    const index = rows.findIndex((r) => r.key === key);
    if (index < 0) return;
    const copy = {
      ...rows[index],
      key: crypto.randomUUID(),
      eye: rows[index].eye === "R" ? ("L" as const) : rows[index].eye,
    };
    onChange([...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)]);
  }

  const totalOf = (row: StockRowDraft) =>
    lineAmount(row.rate, row.quantity, row.discount || fallbackDiscount);
  const subtotal = rows.reduce((sum, row) => sum + totalOf(row), 0);

  return (
    <>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([...rows, blankStockRow("R"), blankStockRow("L")])
          }
        >
          <Plus className="size-4" aria-hidden />
          Add R + L pair
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, blankStockRow()])}
        >
          <Plus className="size-4" aria-hidden />
          Add stock item
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-navy-400 mt-3 rounded-xl border border-dashed border-mist-300 px-4 py-5 text-center text-sm">
          No stock items.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-mist-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <caption className="sr-only">Stock items</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="w-8 px-3 py-2.5 font-medium">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Product
                  </th>
                  <th scope="col" className="w-28 px-2 py-2.5 font-medium">
                    Stock
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
                    Purchase
                  </th>
                  <th scope="col" className="w-24 px-2 py-2.5 font-medium">
                    Sale
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
                {rows.map((row, index) => {
                  const product = stockById.get(row.productId);
                  const item = `stock item ${index + 1}`;
                  return (
                    <tr
                      key={row.key}
                      className="border-t border-mist-200 align-top"
                    >
                      <td className="text-navy-400 px-3 py-2 text-xs">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Product for ${item}`}
                          className={lineCell}
                          value={row.productId}
                          onChange={(e) => pickProduct(row.key, e.target.value)}
                        >
                          <option value="">Select…</option>
                          {stockProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          aria-label={`Stock source for ${item}`}
                          className={lineCell}
                          value={row.stockSource}
                          onChange={(e) =>
                            pickStockSource(
                              row.key,
                              e.target.value as StockRowDraft["stockSource"],
                            )
                          }
                        >
                          <option value="normal">Normal</option>
                          <option
                            value="daily"
                            disabled={product?.category === "services"}
                          >
                            Daily
                          </option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          aria-label={`Eye for ${item}`}
                          className={lineCell}
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
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`SPH for ${item}`}
                          className={lineCell}
                          type="number"
                          step="0.25"
                          inputMode="decimal"
                          placeholder={
                            product?.tracks_power
                              ? sphPlaceholder(product.lens_sign)
                              : ""
                          }
                          value={row.sph}
                          onChange={(e) =>
                            update(row.key, { sph: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`CYL for ${item}`}
                          className={lineCell}
                          type="number"
                          step="0.25"
                          inputMode="decimal"
                          value={row.cyl}
                          onChange={(e) =>
                            update(row.key, { cyl: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`AX for ${item}`}
                          className={lineCell}
                          type="number"
                          step="1"
                          min={0}
                          max={180}
                          inputMode="numeric"
                          value={row.ax}
                          onChange={(e) =>
                            update(row.key, { ax: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`ADD for ${item}`}
                          className={lineCell}
                          type="number"
                          step="0.25"
                          inputMode="decimal"
                          value={row.add}
                          onChange={(e) =>
                            update(row.key, { add: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Purchase price for ${item}`}
                          className={`${lineCell} disabled:text-navy-300 disabled:bg-mist-100`}
                          type="number"
                          step="0.01"
                          min={0}
                          inputMode="decimal"
                          value={row.unitCost}
                          disabled={row.stockSource !== "daily"}
                          placeholder={
                            row.stockSource === "daily" ? "Cost" : "—"
                          }
                          onChange={(e) =>
                            update(row.key, { unitCost: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Sale price for ${item}`}
                          className={lineCell}
                          type="number"
                          step="0.01"
                          min={0}
                          inputMode="decimal"
                          value={row.rate}
                          onChange={(e) =>
                            update(row.key, { rate: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Discount for ${item}`}
                          className={lineCell}
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
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Quantity for ${item}`}
                          className={lineCell}
                          type="number"
                          step="1"
                          min={1}
                          inputMode="numeric"
                          value={row.quantity}
                          onChange={(e) =>
                            update(row.key, { quantity: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatAmount(totalOf(row))}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => duplicate(row.key)}
                            className="text-navy-400 hover:text-navy-600 rounded p-1.5 transition-colors hover:bg-mist-100"
                            title="Duplicate item"
                          >
                            <Copy className="size-4" aria-hidden />
                            <span className="sr-only">Duplicate {item}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onChange(rows.filter((r) => r.key !== row.key))
                            }
                            className="text-navy-400 rounded p-1.5 transition-colors hover:bg-amber-50 hover:text-amber-700"
                            title="Remove item"
                          >
                            <Trash2 className="size-4" aria-hidden />
                            <span className="sr-only">Remove {item}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-mist-200 px-4 py-3">
            <p className="text-navy-500 text-sm">
              {rows.length} {rows.length === 1 ? "item" : "items"}
            </p>
            <p className="text-sm">
              <span className="text-navy-500">Stock items </span>
              <span className="font-semibold tabular-nums">
                Rs {formatAmount(subtotal)}
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
