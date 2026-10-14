import "server-only";

import { requireUser } from "@/server/shop/dal";
import {
  karachiMonthBounds,
  monthlySalesFromTotals,
  productSales,
  type ChannelTotal,
  type MonthReturnTotal,
  type MonthRow,
  type ProductRow,
  type SaleLine,
} from "@/features/shop/sales/monthly";
import { describePostgresError } from "./errors";
import { embeddedPage, selectAllPages } from "./paging";

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

function sellingLines(
  supabase: Shop,
  bounds: { start: string; end: string } | null,
) {
  let query = supabase
    .from("order_lines")
    .select(
      "product_id, product_name, quantity, line_total, unit_cost, stock_source, rx_status, orders!inner(issued_at, voided_at)",
    )
    .not("orders.issued_at", "is", null)
    .is("orders.voided_at", null);
  if (bounds) {
    query = query
      .gte("orders.issued_at", bounds.start)
      .lt("orders.issued_at", bounds.end);
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

/** The lines of one Karachi month, for its product breakdown. Only that month is read. */
async function loadSaleLines(
  supabase: Shop,
  bounds: { start: string; end: string },
): Promise<SaleLine[]> {
  const rows = await selectAllPages<LineRow>((from, to) =>
    embeddedPage<LineRow>(sellingLines(supabase, bounds).range(from, to)),
  ).catch((error: unknown) => {
    throw new Error(describePostgresError(error, "load sales lines"));
  });
  return rows.flatMap((row) => {
    const line = toSaleLine(row);
    return line ? [line] : [];
  });
}

/**
 * Monthly sales by channel, newest month first. `limit` keeps only the latest months.
 *
 * The database totals each month (migration 0042), so this reads a few rows per
 * month rather than every line of the sales history.
 */
export async function listMonthlySales(limit = 12): Promise<MonthRow[]> {
  const { supabase } = await requireUser();

  const [channels, returns] = await Promise.all([
    supabase
      .from("sales_by_channel_monthly")
      .select("month, channel, sales, cost, known_sales, lines_without_cost"),
    supabase.from("sales_returns_monthly").select("month, amount"),
  ]);
  if (channels.error || returns.error) {
    throw new Error(
      describePostgresError(
        channels.error ?? returns.error,
        "load monthly sales",
      ),
    );
  }

  // The views key a month by its first day; the screens use "YYYY-MM".
  const channelTotals: ChannelTotal[] = (channels.data ?? []).map((row) => ({
    month: row.month.slice(0, 7),
    channel: row.channel,
    sales: Number(row.sales),
    cost: Number(row.cost),
    knownSales: Number(row.known_sales),
    linesWithoutCost: row.lines_without_cost,
  }));
  const returnTotals: MonthReturnTotal[] = (returns.data ?? []).map((row) => ({
    month: row.month.slice(0, 7),
    amount: Number(row.amount),
  }));

  return monthlySalesFromTotals(channelTotals, returnTotals).slice(0, limit);
}

/** Sales of one Karachi month (YYYY-MM) broken down by product and channel. */
export async function listMonthProducts(month: string): Promise<ProductRow[]> {
  const { supabase } = await requireUser();
  const lines = await loadSaleLines(supabase, karachiMonthBounds(month));
  return productSales(lines);
}
