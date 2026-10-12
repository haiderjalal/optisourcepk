import "server-only";

import { requireUser } from "@/server/shop/dal";
import {
  karachiMonthBounds,
  monthlySales,
  productSales,
  type MonthRow,
  type ProductRow,
  type ReturnLine,
  type SaleLine,
} from "@/features/shop/sales/monthly";
import { readAllRows } from "./paged";

type Shop = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** A line of an issued, non-voided invoice, with the invoice's issue date. */
interface LineRow {
  product_id: string;
  product_name: string;
  quantity: number;
  line_total: number | string;
  unit_cost: number | string | null;
  stock_source: string;
  rx_status: string | null;
  orders: { issued_at: string | null } | null;
}

interface ReturnRow {
  amount: number | string;
  returned_at: string;
}

function sellingLines(supabase: Shop, bounds: { start: string; end: string } | null) {
  let query = supabase
    .from("order_lines")
    .select(
      "product_id, product_name, quantity, line_total, unit_cost, stock_source, rx_status, orders!inner(issued_at, voided_at)",
    )
    .not("orders.issued_at", "is", null)
    .is("orders.voided_at", null);
  if (bounds) {
    query = query.gte("orders.issued_at", bounds.start).lt("orders.issued_at", bounds.end);
  }
  return query.order("id");
}

function toSaleLine(row: LineRow): SaleLine | null {
  const issuedAt = row.orders?.issued_at;
  if (!issuedAt) return null;
  return {
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    lineTotal: Number(row.line_total),
    unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
    isRx: row.rx_status !== null,
    isDaily: row.stock_source === "daily",
    issuedAt,
  };
}

async function loadSaleLines(supabase: Shop, bounds: { start: string; end: string } | null): Promise<SaleLine[]> {
  const rows = await readAllRows<LineRow>("load sales lines", (from, to) =>
    sellingLines(supabase, bounds).range(from, to),
  );
  return rows.flatMap((row) => {
    const line = toSaleLine(row);
    return line ? [line] : [];
  });
}

/** Monthly sales by channel, newest month first. `limit` keeps only the latest months. */
export async function listMonthlySales(limit = 12): Promise<MonthRow[]> {
  const { supabase } = await requireUser();
  const lines = await loadSaleLines(supabase, null);
  const returns = await readAllRows<ReturnRow>("load sales returns", (from, to) =>
    supabase.from("sales_returns").select("amount, returned_at").order("id").range(from, to),
  );
  const returnLines: ReturnLine[] = returns.map((row) => ({
    amount: Number(row.amount),
    returnedAt: row.returned_at,
  }));
  return monthlySales(lines, returnLines).slice(0, limit);
}

/** Sales of one Karachi month (YYYY-MM) broken down by product and channel. */
export async function listMonthProducts(month: string): Promise<ProductRow[]> {
  const { supabase } = await requireUser();
  const lines = await loadSaleLines(supabase, karachiMonthBounds(month));
  return productSales(lines);
}
