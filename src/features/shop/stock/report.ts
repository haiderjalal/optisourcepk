import { formatPower } from "@/lib/format";
import type { Eye } from "@/types/database";

/**
 * The stock report for one date range: what was bought from suppliers, what the
 * daily stock register recorded, and which invoices sold from that register.
 *
 * Pure: the service loads the rows, and this file works out the totals and the
 * notes. Purchases go to permanent stock, not to the daily register, so a
 * register receipt is typed in by hand and carries no supplier. That is why the
 * purchases and the register are separate sections.
 */

export interface PurchaseReportRow {
  lineId: string;
  /** Invoice date, "YYYY-MM-DD". */
  date: string;
  invoiceNo: string;
  supplier: string;
  product: string;
  /** The power written out, e.g. "SPH -1.00  CYL -0.50  ADD +1.50". */
  power: string;
  eye: Eye | null;
  quantity: number;
  unitCost: number;
  amount: number;
}

export interface RegisterReportRow {
  entryId: string;
  /** Register day, "YYYY-MM-DD". */
  date: string;
  product: string;
  unit: string;
  opening: number;
  received: number;
  outgoing: number;
  closing: number;
  note: string | null;
}

export interface SaleReportRow {
  postingId: string;
  /** Register day the sale drew on, "YYYY-MM-DD". */
  date: string;
  invoiceNo: number | null;
  shop: string;
  product: string;
  unit: string;
  quantity: number;
  /** The product's lines on the invoice, after discount. Null when unpriced. */
  amount: number | null;
}

export interface StockReport {
  purchases: PurchaseReportRow[];
  register: RegisterReportRow[];
  sales: SaleReportRow[];
}

export interface StockReportTotals {
  purchasedQuantity: number;
  purchasedAmount: number;
  received: number;
  sold: number;
  soldQuantity: number;
  soldAmount: number;
  /** Sales with no price on any of their lines, left out of the sale total. */
  salesWithoutAmount: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** "SPH -1.00  CYL -0.50  ADD +1.50", with the parts that are not given left out. */
export function powerText(line: {
  sph: number | null;
  cyl: number | null;
  add_power: number | null;
}): string {
  const parts = [
    line.sph === null ? null : `SPH ${formatPower(line.sph)}`,
    line.cyl === null ? null : `CYL ${formatPower(line.cyl)}`,
    line.add_power === null ? null : `ADD ${formatPower(line.add_power)}`,
  ];
  return parts.filter((part): part is string => part !== null).join("  ");
}

export function stockReportTotals(report: StockReport): StockReportTotals {
  const totals: StockReportTotals = {
    purchasedQuantity: 0,
    purchasedAmount: 0,
    received: 0,
    sold: 0,
    soldQuantity: 0,
    soldAmount: 0,
    salesWithoutAmount: 0,
  };

  for (const row of report.purchases) {
    totals.purchasedQuantity += row.quantity;
    totals.purchasedAmount += row.amount;
  }
  for (const row of report.register) {
    totals.received += row.received;
    totals.sold += row.outgoing;
  }
  for (const row of report.sales) {
    totals.soldQuantity += row.quantity;
    if (row.amount === null) totals.salesWithoutAmount += 1;
    else totals.soldAmount += row.amount;
  }

  return {
    ...totals,
    purchasedAmount: round2(totals.purchasedAmount),
    soldAmount: round2(totals.soldAmount),
  };
}

/** The notes printed under the report: what it does not show, and why. */
export function stockReportNotes(totals: StockReportTotals): string[] {
  const notes = [
    "Purchases go to permanent stock, not to the daily register. A register receipt is typed in by hand, so it carries no supplier.",
  ];
  if (totals.salesWithoutAmount > 0) {
    const count = totals.salesWithoutAmount;
    notes.push(
      `${count} ${count === 1 ? "sale has" : "sales have"} no price on its lines, so ${count === 1 ? "it is" : "they are"} left out of the sale total.`,
    );
  }
  return notes;
}
