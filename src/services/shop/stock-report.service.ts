import "server-only";

import { requireUser } from "@/server/shop/dal";
import { chunk } from "@/lib/utils";
import type { Eye } from "@/types/database";
import {
  powerText,
  type PurchaseReportRow,
  type RegisterReportRow,
  type SaleReportRow,
  type StockReport,
} from "@/features/shop/stock/report";
import { describePostgresError } from "./errors";
import { embeddedPage, selectAllPages } from "./paging";

/** Order lines are read for this many invoices at a time, so each request stays small. */
const LINE_LOOKUP_BATCH = 100;

interface PurchaseLineRow {
  id: string;
  product_name: string;
  sph: number | null;
  cyl: number | null;
  add_power: number | null;
  eye: Eye | null;
  quantity: number;
  unit_cost: number | string;
  line_total: number | string;
}

interface PurchaseRow {
  id: string;
  invoice_no: string;
  invoice_date: string;
  suppliers: { name: string } | null;
  purchase_invoice_lines: PurchaseLineRow[];
}

interface RegisterRow {
  id: string;
  product_name: string;
  unit: string;
  entry_date: string;
  opening_qty: number;
  received_qty: number;
  outgoing_qty: number;
  closing_qty: number;
  note: string | null;
}

interface PostingRow {
  id: string;
  qty: number;
  order_id: string;
  daily_stock_entries: {
    product_id: string;
    product_name: string;
    unit: string;
    entry_date: string;
  } | null;
  orders: { invoice_no: number | null; bill_to_shop: string | null } | null;
}

interface OrderLineRow {
  order_id: string;
  product_id: string;
  line_total: number | string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Every purchase invoice dated in the range, flattened to one row per line. */
async function loadPurchases(range: {
  from: string;
  to: string;
}): Promise<PurchaseReportRow[]> {
  const { supabase } = await requireUser();

  const invoices = await selectAllPages<PurchaseRow>((from, to) =>
    embeddedPage<PurchaseRow>(
      supabase
        .from("purchase_invoices")
        .select(
          "id, invoice_no, invoice_date, suppliers(name), purchase_invoice_lines(id, product_name, sph, cyl, add_power, eye, quantity, unit_cost, line_total)",
        )
        .gte("invoice_date", range.from)
        .lte("invoice_date", range.to)
        .order("invoice_date")
        .order("id")
        .range(from, to),
    ),
  ).catch((error: unknown) => {
    throw new Error(describePostgresError(error, "load the purchases"));
  });

  return invoices
    .flatMap((invoice) =>
      invoice.purchase_invoice_lines.map((line) => ({
        lineId: line.id,
        date: invoice.invoice_date,
        invoiceNo: invoice.invoice_no,
        supplier: invoice.suppliers?.name ?? "—",
        product: line.product_name,
        power: powerText(line),
        eye: line.eye,
        quantity: line.quantity,
        unitCost: Number(line.unit_cost),
        amount: Number(line.line_total),
      })),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.invoiceNo.localeCompare(b.invoiceNo) ||
        a.product.localeCompare(b.product),
    );
}

/** The daily register's rows dated in the range, one per item per day. */
async function loadRegister(range: {
  from: string;
  to: string;
}): Promise<RegisterReportRow[]> {
  const { supabase } = await requireUser();

  const rows = await selectAllPages<RegisterRow>((from, to) =>
    supabase
      .from("daily_stock_entries")
      .select(
        "id, product_name, unit, entry_date, opening_qty, received_qty, outgoing_qty, closing_qty, note",
      )
      .gte("entry_date", range.from)
      .lte("entry_date", range.to)
      .order("entry_date")
      .order("id")
      .range(from, to),
  ).catch((error: unknown) => {
    throw new Error(describePostgresError(error, "load the daily register"));
  });

  return rows
    .map((row) => ({
      entryId: row.id,
      date: row.entry_date,
      product: row.product_name,
      unit: row.unit,
      opening: row.opening_qty,
      received: row.received_qty,
      outgoing: row.outgoing_qty,
      closing: row.closing_qty,
      note: row.note,
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.product.localeCompare(b.product),
    );
}

/**
 * The invoices that drew on the register in the range, one row per item each.
 * The amount is what the invoice charged for that item's lines, so the sale
 * total can be checked against the invoices.
 */
async function loadSales(range: {
  from: string;
  to: string;
}): Promise<SaleReportRow[]> {
  const { supabase } = await requireUser();

  const postings = await selectAllPages<PostingRow>((from, to) =>
    embeddedPage<PostingRow>(
      supabase
        .from("daily_stock_postings")
        .select(
          "id, qty, order_id, daily_stock_entries!inner(product_id, product_name, unit, entry_date), orders!inner(invoice_no, bill_to_shop)",
        )
        .gte("daily_stock_entries.entry_date", range.from)
        .lte("daily_stock_entries.entry_date", range.to)
        .is("orders.voided_at", null)
        .order("id")
        .range(from, to),
    ),
  ).catch((error: unknown) => {
    throw new Error(describePostgresError(error, "load the daily sales"));
  });

  const orderIds = [...new Set(postings.map((posting) => posting.order_id))];
  const lineReads = await Promise.all(
    chunk(orderIds, LINE_LOOKUP_BATCH).map((ids) =>
      selectAllPages<OrderLineRow>((from, to) =>
        supabase
          .from("order_lines")
          .select("order_id, product_id, line_total")
          .in("order_id", ids)
          .order("id")
          .range(from, to),
      ),
    ),
  ).catch((error: unknown) => {
    throw new Error(describePostgresError(error, "load the daily sales"));
  });

  const amountByOrderItem = new Map<string, number>();
  for (const line of lineReads.flat()) {
    const key = `${line.order_id}|${line.product_id}`;
    amountByOrderItem.set(
      key,
      (amountByOrderItem.get(key) ?? 0) + Number(line.line_total),
    );
  }

  return postings
    .flatMap((posting) => {
      const entry = posting.daily_stock_entries;
      const order = posting.orders;
      if (!entry || !order) return [];
      const amount = amountByOrderItem.get(
        `${posting.order_id}|${entry.product_id}`,
      );
      return [
        {
          postingId: posting.id,
          date: entry.entry_date,
          invoiceNo: order.invoice_no,
          shop: order.bill_to_shop ?? "—",
          product: entry.product_name,
          unit: entry.unit,
          quantity: posting.qty,
          amount: amount === undefined ? null : round2(amount),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.invoiceNo ?? 0) - (b.invoiceNo ?? 0) ||
        a.product.localeCompare(b.product),
    );
}

/** Purchases, the daily register and the invoices that sold from it, for one date range. */
export async function loadStockReport(range: {
  from: string;
  to: string;
}): Promise<StockReport> {
  const [purchases, register, sales] = await Promise.all([
    loadPurchases(range),
    loadRegister(range),
    loadSales(range),
  ]);
  return { purchases, register, sales };
}
