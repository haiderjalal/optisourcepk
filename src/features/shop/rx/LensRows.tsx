"use client";

import { Fragment } from "react";
import { inputClass } from "@/components/ui/field";
import { formatAmount, formatRxNo } from "@/lib/format";
import type { OrderLine } from "@/types/database";
import { cell } from "./StockItemRows";

/**
 * The lenses on a reopened combined RX invoice, one row per eye, grouped by the
 * RX order they were billed from. Power, quantity, discount and sale price are
 * editable, and so is the patient of each RX order. The eye, the product and the
 * lab details are shown as they were booked.
 */

export interface LensDraft {
  id: string;
  /** The RX order this lens came from, read from its reference ("9493 · RX-0006"). */
  rxNo: number | null;
  eye: string;
  product: string;
  sph: string;
  cyl: string;
  ax: string;
  add: string;
  quantity: string;
  rate: string;
  discount: string;
}

/** Patient names by RX number. */
export type PatientDrafts = Record<number, string>;

const RX_REFERENCE = /RX-(\d+)$/;

const POWER_FIELDS = [
  ["sph", "Sphere"],
  ["cyl", "Cyl"],
  ["ax", "Axis"],
  ["add", "Add"],
] as const;

function rxNoOf(line: OrderLine): number | null {
  const match = RX_REFERENCE.exec(line.order_ref ?? "");
  return match ? Number(match[1]) : null;
}

/** The lens lines of an invoice, each RX order's together and in RX order. */
export function lensRowsFrom(lines: OrderLine[]): LensDraft[] {
  const text = (v: number | null) => (v === null ? "" : String(v));
  return lines
    .filter((line) => line.rx_status !== null)
    .map((line) => ({
      id: line.id,
      rxNo: rxNoOf(line),
      eye: line.eye ?? "",
      product: line.product_name,
      sph: text(line.sph),
      cyl: text(line.cyl),
      ax: text(line.ax),
      add: text(line.add_power),
      quantity: String(line.quantity),
      rate: String(line.unit_price),
      discount: String(line.discount_pct),
    }))
    .sort((a, b) => (a.rxNo ?? 0) - (b.rxNo ?? 0));
}

/** Each RX order's patient, from the first of its lines that has one. */
export function patientsFrom(lines: OrderLine[]): PatientDrafts {
  const patients: PatientDrafts = {};
  for (const line of lines) {
    const rxNo = rxNoOf(line);
    if (rxNo === null || line.rx_status === null) continue;
    patients[rxNo] ??= line.patient_name ?? "";
  }
  return patients;
}

function describe(row: LensDraft): string {
  const eye = row.eye === "R" ? "right" : row.eye === "L" ? "left" : "";
  return `${eye ? `${eye} lens` : "lens"} of ${formatRxNo(row.rxNo)}`;
}

/** Why a lens cannot be saved yet, or null when it can. */
function lensProblem(row: LensDraft): string | null {
  const quantity = Number(row.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return `Enter a whole-number quantity for the ${describe(row)}.`;
  }
  if (!(Number(row.rate) > 0)) {
    return `Enter a sale price for the ${describe(row)}.`;
  }
  if (row.ax !== "" && row.cyl === "") {
    return `An axis needs a cylinder value on the ${describe(row)}.`;
  }
  return null;
}

/** The first reason the lenses cannot be saved, or null when they all can. */
export function firstLensProblem(rows: LensDraft[]): string | null {
  for (const row of rows) {
    const problem = lensProblem(row);
    if (problem) return problem;
  }
  return null;
}

/** The lenses as the save action reads them. A lens with no RX number stays as it is. */
export function lensPayload(rows: LensDraft[], patients: PatientDrafts) {
  const rxNos = new Set<number>();
  const lines = [];
  for (const row of rows) {
    if (row.rxNo === null) continue;
    rxNos.add(row.rxNo);
    lines.push({
      id: row.id,
      sph: row.sph,
      cyl: row.cyl,
      ax: row.ax,
      addPower: row.add,
      unitPrice: row.rate,
      discountPct: row.discount,
      quantity: row.quantity,
    });
  }
  return {
    patients: [...rxNos].map((rxNo) => ({
      rxNo,
      patientName: patients[rxNo] ?? "",
    })),
    lines,
  };
}

/** Rounded as the database rounds a line: gross and discount each to the paisa. */
function lineTotal(row: LensDraft): number {
  const price = Number(row.rate) || 0;
  const quantity = Number(row.quantity) || 0;
  const discount = Number(row.discount) || 0;
  const gross = Math.round(price * quantity * 100) / 100;
  return gross - Math.round(((gross * discount) / 100) * 100) / 100;
}

export function LensRows({
  rows,
  patients,
  onRowsChange,
  onPatientChange,
}: {
  rows: LensDraft[];
  patients: PatientDrafts;
  onRowsChange: (rows: LensDraft[]) => void;
  onPatientChange: (rxNo: number, patientName: string) => void;
}) {
  function update(id: string, patch: Partial<LensDraft>) {
    onRowsChange(
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <caption className="sr-only">Lenses on this invoice</caption>
        <thead>
          <tr className="text-navy-600 bg-mist-100 text-xs">
            <th scope="col" className="w-12 px-3 py-2 text-left font-medium">
              Eye
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Lens
            </th>
            {POWER_FIELDS.map(([key, label]) => (
              <th key={key} scope="col" className="px-2 py-2 font-medium">
                {label}
              </th>
            ))}
            <th scope="col" className="px-2 py-2 font-medium">
              Qty
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Sale price
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Disc %
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rxNo = row.rxNo;
            const startsOrder = index === 0 || rows[index - 1].rxNo !== rxNo;
            const editable = rxNo !== null;
            return (
              <Fragment key={row.id}>
                {startsOrder && rxNo !== null && (
                  <tr className="border-t border-mist-200 bg-mist-100/50">
                    <td colSpan={10} className="px-3 py-2">
                      <label className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-navy-700 font-semibold">
                          {formatRxNo(rxNo)}
                        </span>
                        <span className="text-navy-500">Patient name</span>
                        <input
                          type="text"
                          maxLength={120}
                          className={`${inputClass} max-w-xs`}
                          value={patients[rxNo] ?? ""}
                          onChange={(e) =>
                            onPatientChange(rxNo, e.target.value)
                          }
                        />
                      </label>
                    </td>
                  </tr>
                )}
                <tr className="border-t border-mist-200">
                  <th
                    scope="row"
                    className="text-navy-700 px-3 py-2 text-left font-medium"
                  >
                    {row.eye || "—"}
                  </th>
                  <td className="px-3 py-2">{row.product}</td>
                  {POWER_FIELDS.map(([key, label]) => (
                    <td key={key} className="px-1.5 py-1.5">
                      <input
                        aria-label={`${label}, ${describe(row)}`}
                        className={cell}
                        type="number"
                        step={key === "ax" ? "1" : "0.25"}
                        min={key === "ax" || key === "add" ? 0 : undefined}
                        max={key === "ax" ? 180 : key === "add" ? 6 : undefined}
                        inputMode="decimal"
                        disabled={!editable}
                        value={row[key]}
                        onChange={(e) =>
                          update(row.id, { [key]: e.target.value })
                        }
                      />
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5">
                    <input
                      aria-label={`Quantity, ${describe(row)}`}
                      className={cell}
                      type="number"
                      step="1"
                      min={1}
                      max={100000}
                      inputMode="numeric"
                      disabled={!editable}
                      value={row.quantity}
                      onChange={(e) =>
                        update(row.id, { quantity: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      aria-label={`Sale price, ${describe(row)}`}
                      className={cell}
                      type="number"
                      step="0.01"
                      min={0}
                      inputMode="decimal"
                      disabled={!editable}
                      value={row.rate}
                      onChange={(e) => update(row.id, { rate: e.target.value })}
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      aria-label={`Discount percent, ${describe(row)}`}
                      className={cell}
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      inputMode="decimal"
                      disabled={!editable}
                      value={row.discount}
                      onChange={(e) =>
                        update(row.id, { discount: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAmount(lineTotal(row))}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
