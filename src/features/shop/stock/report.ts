import { formatPower } from "@/lib/format";

/**
 * The stock report for one date range: what was bought from suppliers, what the
 * daily stock register recorded, and what was sold on issued invoices, from both
 * normal and daily stock.
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
  quantity: number;
  /** What was paid per unit on this invoice. */
  purchasedPrice: number;
  /** The product's list price today, per unit. Null when the product has none. */
  salePrice: number | null;
  /** The line total as bought. */
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

/** Normal stock is kept on the shelf; daily stock is counted in the register. */
export type StockChannel = "normal" | "daily";

export interface SaleReportRow {
  lineId: string;
  /** The day the invoice was issued, "YYYY-MM-DD". */
  date: string;
  invoiceNo: number | null;
  channel: StockChannel;
  shop: string;
  product: string;
  unit: string;
  quantity: number;
  /** What the product cost us per unit, as stored on the line. Null when none is stored. */
  purchasedPrice: number | null;
  /** What the line sold for per unit, before discount. Zero when unpriced. */
  salePrice: number;
  /** The line total, after discount. */
  amount: number;
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
  /** Sales with no price on their lines, left out of the sale total. */
  unpricedSales: number;
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
    unpricedSales: 0,
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
    totals.soldAmount += row.amount;
    if (row.salePrice === 0) totals.unpricedSales += 1;
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
    "A purchase's sale price is the product's list price today, not the price it sold for.",
    "The register's sold figure is daily stock only. Sales cover normal and daily stock on issued invoices.",
  ];
  if (totals.unpricedSales > 0) {
    const count = totals.unpricedSales;
    notes.push(
      `${count} ${count === 1 ? "sale has" : "sales have"} no price on its lines, so ${count === 1 ? "it is" : "they are"} left out of the sale total.`,
    );
  }
  return notes;
}
