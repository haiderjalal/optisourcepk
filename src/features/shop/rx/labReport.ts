/**
 * The RX lab report: one row per RX order, so our figures can be checked against the lab's ledger. Pure: the service
 * loads the orders and their lenses, and this file works out each order's row and the totals.
 *
 * A lens's purchase price is what the lab charges for it and its sale price is what the shop bills, both per lens. An
 * order's purchase is left blank when any of its lenses has no cost stored, rather than counted as free. Voided orders
 * are listed but left out of the totals, as the sales reports do.
 */

export interface RxLabLens {
  quantity: number;
  /** Per lens, before discount. */
  unitPrice: number;
  /** After discount. */
  lineTotal: number;
  /** Per lens, what the lab charged; null when none is stored. */
  unitCost: number | null;
  supplierName: string | null;
}

export interface RxLabOrder {
  id: string;
  rxNo: number | null;
  labOrderNo: string | null;
  /** Karachi calendar date, "YYYY-MM-DD". */
  date: string;
  patientName: string | null;
  shopName: string;
  voided: boolean;
  lenses: RxLabLens[];
}

export interface RxLabRow {
  orderId: string;
  rxNo: number | null;
  labOrderNo: string | null;
  date: string;
  lab: string;
  patientName: string | null;
  shopName: string;
  voided: boolean;
  lenses: number;
  /** Null when a lens has no purchase price stored. */
  purchase: number | null;
  /** Null when no lens has been priced yet. */
  sale: number | null;
}

export interface RxLabTotals {
  /** Orders that are not voided. */
  orders: number;
  lenses: number;
  purchase: number;
  sale: number;
  /** Orders that are not voided and have no purchase total, so are left out of purchase. */
  ordersWithoutPurchase: number;
  voided: number;
}

const KARACHI_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
});

/** The Karachi calendar date an instant falls on, as "YYYY-MM-DD". */
export function karachiDate(at: string): string {
  return KARACHI_DAY.format(new Date(at));
}

/**
 * The UTC instants at which a Karachi date range starts (the first day's midnight) and ends (the midnight after its
 * last day). Karachi is UTC+5 all year round.
 */
export function karachiRangeBounds(range: { from: string; to: string }): {
  start: string;
  end: string;
} {
  const [fromYear, fromMonth, fromDay] = range.from.split("-").map(Number);
  const [toYear, toMonth, toDay] = range.to.split("-").map(Number);
  return {
    start: new Date(
      Date.UTC(fromYear, fromMonth - 1, fromDay, -5),
    ).toISOString(),
    end: new Date(Date.UTC(toYear, toMonth - 1, toDay + 1, -5)).toISOString(),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** One order's row. Its purchase and sale are each left blank when they cannot be stated in full. */
export function rxLabRow(order: RxLabOrder): RxLabRow {
  const purchase = order.lenses.every((lens) => lens.unitCost !== null)
    ? round2(
        order.lenses.reduce(
          (total, lens) => total + (lens.unitCost ?? 0) * lens.quantity,
          0,
        ),
      )
    : null;
  const sale = order.lenses.some((lens) => lens.unitPrice > 0)
    ? round2(order.lenses.reduce((total, lens) => total + lens.lineTotal, 0))
    : null;
  const labs = [
    ...new Set(
      order.lenses.flatMap((lens) =>
        lens.supplierName ? [lens.supplierName] : [],
      ),
    ),
  ];

  return {
    orderId: order.id,
    rxNo: order.rxNo,
    labOrderNo: order.labOrderNo,
    date: order.date,
    lab: labs.length > 0 ? labs.join(", ") : "—",
    patientName: order.patientName,
    shopName: order.shopName,
    voided: order.voided,
    lenses: order.lenses.reduce((total, lens) => total + lens.quantity, 0),
    purchase,
    sale,
  };
}

export function rxLabTotals(rows: RxLabRow[]): RxLabTotals {
  const totals: RxLabTotals = {
    orders: 0,
    lenses: 0,
    purchase: 0,
    sale: 0,
    ordersWithoutPurchase: 0,
    voided: 0,
  };

  for (const row of rows) {
    if (row.voided) {
      totals.voided += 1;
      continue;
    }
    totals.orders += 1;
    totals.lenses += row.lenses;
    totals.sale += row.sale ?? 0;
    if (row.purchase === null) totals.ordersWithoutPurchase += 1;
    else totals.purchase += row.purchase;
  }

  return {
    ...totals,
    purchase: round2(totals.purchase),
    sale: round2(totals.sale),
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string | null | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  // Date.parse rolls 30 February over into March, so the date must read back unchanged.
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

/**
 * The date range a report asks for: its From and To when they are valid dates,
 * otherwise the current Karachi month up to today.
 */
export function resolveLabReportRange(
  query: { from?: string | null; to?: string | null },
  today: string,
): { from: string; to: string } {
  return {
    from: isDate(query.from) ? query.from : `${today.slice(0, 7)}-01`,
    to: isDate(query.to) ? query.to : today,
  };
}

const plural = (count: number, one: string, many: string) =>
  count === 1 ? one : many;

/** The label on the totals row: how many orders the totals add up. */
export function labReportTotalLabel(totals: RxLabTotals): string {
  return `Total, ${totals.orders} ${plural(totals.orders, "order", "orders")}`;
}

/** The notes printed under the totals, one for each thing the totals leave out. */
export function labReportNotes(totals: RxLabTotals): string[] {
  const notes: string[] = [];
  if (totals.ordersWithoutPurchase > 0) {
    const count = totals.ordersWithoutPurchase;
    notes.push(
      `${count} ${plural(count, "order", "orders")} marked "no cost" left out of the purchase total: a lens has no purchase price yet.`,
    );
  }
  if (totals.voided > 0) {
    const count = totals.voided;
    notes.push(
      `${count} voided ${plural(count, "order is", "orders are")} listed but left out of the totals.`,
    );
  }
  return notes;
}
