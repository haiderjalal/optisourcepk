import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { SalesReturn, SalesReturnLine } from "@/types/database";
import { describePostgresError } from "./errors";

/**
 * Returns: items a shop sent back from an issued invoice. Recording and
 * undoing a return move stock and the shop's account in one database
 * transaction (`record_sales_return`, `delete_sales_return`).
 */

export interface ReturnWithDetail extends SalesReturn {
  lines: SalesReturnLine[];
  invoiceNo: number | null;
  shopName: string;
}

/** Returns newest first, with their lines, invoice number and shop. */
export async function listReturns(filter: {
  orderId?: string;
  limit?: number;
}): Promise<ReturnWithDetail[]> {
  const { supabase } = await requireUser();

  let query = supabase
    .from("sales_returns")
    .select("*")
    .order("returned_at", { ascending: false })
    .limit(filter.limit ?? 50);
  if (filter.orderId) query = query.eq("order_id", filter.orderId);

  const { data: returns, error } = await query;
  if (error) throw new Error(describePostgresError(error, "load returns"));
  if (!returns || returns.length === 0) return [];

  const [lines, orders, customers] = await Promise.all([
    supabase
      .from("sales_return_lines")
      .select("*")
      .in(
        "return_id",
        returns.map((r) => r.id),
      ),
    supabase
      .from("orders")
      .select("id, invoice_no")
      .in("id", [...new Set(returns.map((r) => r.order_id))]),
    supabase
      .from("customers")
      .select("id, shop_name")
      .in("id", [...new Set(returns.map((r) => r.customer_id))]),
  ]);
  const failed = lines.error ?? orders.error ?? customers.error;
  if (failed) throw new Error(describePostgresError(failed, "load returns"));

  const invoiceNo = new Map(
    (orders.data ?? []).map((o) => [o.id, o.invoice_no]),
  );
  const shop = new Map((customers.data ?? []).map((c) => [c.id, c.shop_name]));

  return returns.map((r) => ({
    ...r,
    lines: (lines.data ?? []).filter((l) => l.return_id === r.id),
    invoiceNo: invoiceNo.get(r.order_id) ?? null,
    shopName: shop.get(r.customer_id) ?? "—",
  }));
}

/** How many of each invoice line have been returned, from its returns. */
export function returnedQuantities(
  returns: ReturnWithDetail[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of returns.flatMap((r) => r.lines)) {
    out[line.order_line_id] = (out[line.order_line_id] ?? 0) + line.quantity;
  }
  return out;
}

export async function recordReturn(input: {
  orderId: string;
  lines: { orderLineId: string; qty: number }[];
  note: string | null;
}): Promise<SalesReturn> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("record_sales_return", {
    p_order_id: input.orderId,
    p_lines: input.lines,
    p_note: input.note,
  });
  if (error) throw new Error(describePostgresError(error, "record the return"));

  logger.info("Return recorded", {
    orderId: input.orderId,
    returnNo: data.return_no,
  });
  return data;
}

/** Undo a return: stock comes off again and the credit is removed. */
export async function deleteReturn(returnId: string): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("delete_sales_return", {
    p_return_id: returnId,
  });
  if (error) throw new Error(describePostgresError(error, "undo the return"));

  logger.info("Return undone", { returnId });
}
