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
  product: string;
  quantity: number;
  /** The supplier the stock was bought from. */
  supplier: string;
  /** What was paid per unit on this invoice. */
  purchasedPrice: number;
  /** The product's list price today, per unit. Null when the product has none. */
  salePrice: number | null;
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
  product: string;
  unit: string;
  quantity: number;
  /** The person the invoice was made out to, as named on the customer's bill. */
  purchaser: string;
  /** The shop the invoice was made out to. */
  shop: string;
  channel: StockChannel;
  /** What the product cost us per unit, as stored on the line. Null when none is stored. */
  purchasedPrice: number | null;
  /** What the line sold for per unit, before discount. Zero when unpriced. */
  salePrice: number;
}

export interface StockReport {
  purchases: PurchaseReportRow[];
  register: RegisterReportRow[];
  sales: SaleReportRow[];
}

export interface StockReportTotals {
  purchasedQuantity: number;
  /** Everything bought, valued at the price paid per unit. */
  purchasedAtCost: number;
  /** Everything bought, valued at the list price per unit. */
  purchasedAtSalePrice: number;
  /** Purchase lines with no list price, left out of purchasedAtSalePrice. */
  purchasesWithoutListPrice: number;
  received: number;
  sold: number;
  soldQuantity: number;
  /** Everything sold, valued at the price paid per unit where one is stored. */
  soldAtCost: number;
  /** Everything sold, valued at the sale price per unit, before discount. */
  soldAtSalePrice: number;
  /** Sales with no price on their lines, left out of the sale total. */
  unpricedSales: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A purchase line's total at the price paid: quantity times the purchased price. */
export function purchasePriceTotal(
  row: Pick<PurchaseReportRow, "quantity" | "purchasedPrice">,
): number {
  return round2(row.quantity * row.purchasedPrice);
}

/** A purchase line's total at the list price. Null when the product has none. */
export function purchaseSaleTotal(
  row: Pick<PurchaseReportRow, "quantity" | "salePrice">,
): number | null {
  return row.salePrice === null ? null : round2(row.quantity * row.salePrice);
}

/** A sale line's total at the price paid. Null when no cost is stored on the line. */
export function soldPurchaseTotal(
  row: Pick<SaleReportRow, "quantity" | "purchasedPrice">,
): number | null {
  return row.purchasedPrice === null
    ? null
    : round2(row.quantity * row.purchasedPrice);
}

/** A sale line's total at the sale price, before discount. */
export function soldSaleTotal(
  row: Pick<SaleReportRow, "quantity" | "salePrice">,
): number {
  return round2(row.quantity * row.salePrice);
}

export function stockReportTotals(report: StockReport): StockReportTotals {
  const totals: StockReportTotals = {
    purchasedQuantity: 0,
    purchasedAtCost: 0,
    purchasedAtSalePrice: 0,
    purchasesWithoutListPrice: 0,
    received: 0,
    sold: 0,
    soldQuantity: 0,
    soldAtCost: 0,
    soldAtSalePrice: 0,
    unpricedSales: 0,
  };

  for (const row of report.purchases) {
    totals.purchasedQuantity += row.quantity;
    totals.purchasedAtCost += row.purchasedPrice * row.quantity;
    if (row.salePrice === null) totals.purchasesWithoutListPrice += 1;
    else totals.purchasedAtSalePrice += row.salePrice * row.quantity;
  }
  for (const row of report.register) {
    totals.received += row.received;
    totals.sold += row.outgoing;
  }
  for (const row of report.sales) {
    totals.soldQuantity += row.quantity;
    totals.soldAtSalePrice += row.salePrice * row.quantity;
    const cost = soldPurchaseTotal(row);
    if (cost !== null) totals.soldAtCost += cost;
    if (row.salePrice === 0) totals.unpricedSales += 1;
  }

  return {
    ...totals,
    purchasedAtCost: round2(totals.purchasedAtCost),
    purchasedAtSalePrice: round2(totals.purchasedAtSalePrice),
    soldAtCost: round2(totals.soldAtCost),
    soldAtSalePrice: round2(totals.soldAtSalePrice),
  };
}

/** The notes printed under the report: what it does not show, and why. */
export function stockReportNotes(totals: StockReportTotals): string[] {
  const notes = [
    "Purchase price and sale price are the totals for the quantity on each line.",
    "Purchases go to permanent stock, not to the daily register. A register receipt is typed in by hand, so it carries no supplier.",
    "A purchase's sale price is the product's list price today, not the price it sold for.",
    "The register's sold figure is daily stock only. Sales cover normal and daily stock on issued invoices.",
  ];
  if (totals.purchasesWithoutListPrice > 0) {
    const count = totals.purchasesWithoutListPrice;
    notes.push(
      `${count} ${count === 1 ? "purchase line has" : "purchase lines have"} no list price, so ${count === 1 ? "it is" : "they are"} left out of the purchase sale price total.`,
    );
  }
  if (totals.unpricedSales > 0) {
    const count = totals.unpricedSales;
    notes.push(
      `${count} ${count === 1 ? "sale has" : "sales have"} no price on its lines, so ${count === 1 ? "it is" : "they are"} left out of the sale total.`,
    );
  }
  return notes;
}
