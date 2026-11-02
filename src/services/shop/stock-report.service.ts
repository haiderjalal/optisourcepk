import "server-only";

import { requireUser } from "@/server/shop/dal";
import { karachiDate, karachiRangeBounds } from "@/lib/date-range";
import {
  type PurchaseReportRow,
  type RegisterReportRow,
  type SaleReportRow,
  type StockChannel,
  type StockReport,
} from "@/features/shop/stock/report";
import { describePostgresError } from "./errors";
import { embeddedPage, selectAllPages } from "./paging";

interface PurchaseLineRow {
  id: string;
  product_name: string;
  quantity: number;
  unit_cost: number | string;
  products: { list_price: number | string } | null;
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

interface SaleLineRow {
  id: string;
  product_name: string;
  unit: string;
  stock_source: StockChannel;
  quantity: number;
  unit_price: number | string;
  unit_cost: number | string | null;
  products: { purchase_price: number | string; is_rx: boolean } | null;
  orders: {
    id: string;
    invoice_no: number | null;
    bill_to_name: string | null;
    bill_to_shop: string | null;
    issued_at: string;
    is_rx: boolean;
    combines_rx: boolean;
  } | null;
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
          "id, invoice_no, invoice_date, suppliers(name), purchase_invoice_lines(id, product_name, quantity, unit_cost, products(list_price))",
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
        purchaseId: invoice.id,
        product: line.product_name,
        quantity: line.quantity,
        supplier: invoice.suppliers?.name ?? "—",
        purchasedPrice: Number(line.unit_cost),
        salePrice:
          line.products === null ? null : Number(line.products.list_price),
      })),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.supplier.localeCompare(b.supplier) ||
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
 * What a sold line cost us per unit. Daily-stock lines store it; normal invoices
 * do not, so they fall back to the product's purchase price today, as the order
 * form does. A product with no purchase price gives no cost.
 */
function soldUnitCost(line: SaleLineRow): {
  price: number | null;
  fromProduct: boolean;
} {
  if (line.unit_cost !== null) {
    return { price: Number(line.unit_cost), fromProduct: false };
  }
  const productCost = Number(line.products?.purchase_price ?? 0);
  return productCost > 0
    ? { price: productCost, fromProduct: true }
    : { price: null, fromProduct: false };
}

/** Oldest first, then by invoice number and product. */
function bySaleOrder(a: SaleReportRow, b: SaleReportRow): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.invoiceNo ?? 0) - (b.invoiceNo ?? 0) ||
    a.product.localeCompare(b.product)
  );
}

/**
 * Every line sold on an issued, non-voided invoice in the range, from normal and
 * daily stock alike, one row per line, dated by the day the invoice was issued.
 *
 * Split by what the invoice is, not only by the line: a line on an RX order or a
 * combined RX invoice is RX work, so it goes in `rxSales` and never among the
 * stock orders. RX lenses are left out altogether: they have their own report.
 * A lens is known by its lab status, or by its RX product when an edit made
 * before migration 0048 stripped that status.
 */
async function loadSales(range: {
  from: string;
  to: string;
}): Promise<Pick<StockReport, "sales" | "rxSales">> {
  const { supabase } = await requireUser();
  const bounds = karachiRangeBounds(range);

  const lines = await selectAllPages<SaleLineRow>((from, to) =>
    embeddedPage<SaleLineRow>(
      supabase
        .from("order_lines")
        .select(
          "id, product_name, unit, stock_source, quantity, unit_price, unit_cost, products(purchase_price, is_rx), orders!inner(id, invoice_no, bill_to_name, bill_to_shop, issued_at, voided_at, is_rx, combines_rx)",
        )
        .is("rx_status", null)
        .gte("orders.issued_at", bounds.start)
        .lt("orders.issued_at", bounds.end)
        .is("orders.voided_at", null)
        .order("id")
        .range(from, to),
    ),
  ).catch((error: unknown) => {
    throw new Error(describePostgresError(error, "load the sales"));
  });

  const sales: SaleReportRow[] = [];
  const rxSales: SaleReportRow[] = [];
  for (const line of lines) {
    const order = line.orders;
    if (!order || line.products?.is_rx) continue;
    const cost = soldUnitCost(line);
    const row: SaleReportRow = {
      lineId: line.id,
      date: karachiDate(order.issued_at),
      invoiceNo: order.invoice_no,
      orderId: order.id,
      product: line.product_name,
      unit: line.unit,
      quantity: line.quantity,
      purchaser: order.bill_to_name ?? "—",
      shop: order.bill_to_shop ?? "—",
      channel: line.stock_source,
      purchasedPrice: cost.price,
      costFromProduct: cost.fromProduct,
      salePrice: Number(line.unit_price),
    };
    (order.is_rx || order.combines_rx ? rxSales : sales).push(row);
  }

  return {
    sales: sales.sort(bySaleOrder),
    rxSales: rxSales.sort(bySaleOrder),
  };
}

/** Purchases, the daily register and the sales on issued invoices, for one date range. */
export async function loadStockReport(range: {
  from: string;
  to: string;
}): Promise<StockReport> {
  const [purchases, register, sold] = await Promise.all([
    loadPurchases(range),
    loadRegister(range),
    loadSales(range),
  ]);
  return { purchases, register, ...sold };
}
