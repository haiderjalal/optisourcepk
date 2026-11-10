import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { Order, SalesReturn, SalesReturnLine } from "@/types/database";
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
  customerId?: string;
  limit?: number;
}): Promise<ReturnWithDetail[]> {
  const { supabase } = await requireUser();

  let query = supabase
    .from("sales_returns")
    .select("*")
    .order("returned_at", { ascending: false })
    .limit(filter.limit ?? 50);
  if (filter.orderId) query = query.eq("order_id", filter.orderId);
  if (filter.customerId) query = query.eq("customer_id", filter.customerId);

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

/** A returned line as the sales return document prints it: where it sat on the invoice. */
export type ReturnDocumentLine = SalesReturnLine & {
  orderRef: string | null;
  discountPct: number;
  lineNo: number;
};

/** A sales return with the invoice it reverses, for its printed document. */
export interface ReturnDocument {
  ret: SalesReturn;
  /** In the order the lines sat on the invoice. */
  lines: ReturnDocumentLine[];
  invoice: Pick<
    Order,
    | "invoice_no"
    | "bill_to_name"
    | "bill_to_shop"
    | "bill_to_address"
    | "bill_to_ntn"
    | "bill_to_strn"
    | "order_by_name"
  >;
}

/** The return and its invoice, or null when there is no such return. */
export async function getReturnDocument(
  returnId: string,
): Promise<ReturnDocument | null> {
  const { supabase } = await requireUser();

  const { data: ret, error: returnError } = await supabase
    .from("sales_returns")
    .select("*")
    .eq("id", returnId)
    .maybeSingle();
  if (returnError) {
    throw new Error(describePostgresError(returnError, "load the return"));
  }
  if (!ret) return null;

  const { data: lines, error: linesError } = await supabase
    .from("sales_return_lines")
    .select("*")
    .eq("return_id", ret.id);
  if (linesError) {
    throw new Error(describePostgresError(linesError, "load the return"));
  }

  const [orderLines, invoice] = await Promise.all([
    supabase
      .from("order_lines")
      .select("id, order_ref, discount_pct, line_no")
      .in(
        "id",
        (lines ?? []).map((line) => line.order_line_id),
      ),
    supabase
      .from("orders")
      .select(
        "invoice_no, bill_to_name, bill_to_shop, bill_to_address, bill_to_ntn, bill_to_strn, order_by_name",
      )
      .eq("id", ret.order_id)
      .single(),
  ]);
  const failed = orderLines.error ?? invoice.error;
  if (failed) throw new Error(describePostgresError(failed, "load the return"));

  const sourceById = new Map((orderLines.data ?? []).map((l) => [l.id, l]));
  const documentLines = (lines ?? [])
    .map((line) => {
      const source = sourceById.get(line.order_line_id);
      return {
        ...line,
        orderRef: source?.order_ref ?? null,
        discountPct: Number(source?.discount_pct ?? 0),
        lineNo: source?.line_no ?? 0,
      };
    })
    .sort((a, b) => a.lineNo - b.lineNo);

  if (!invoice.data) {
    throw new Error("The invoice this return reverses could not be found.");
  }
  return { ret, lines: documentLines, invoice: invoice.data };
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
