import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { OrderLine, RxMonth, RxStatus } from "@/types/database";
import { describePostgresError } from "./errors";

/**
 * RX jobs: lenses made to a prescription and ordered from a lab.
 *
 * An RX job is an order line on an RX product. The order carries the shop and
 * the invoice; the line carries the power, what the lab charged, and whether
 * the lens is back yet.
 */

export interface RxJob extends OrderLine {
  orderNo: number;
  invoiceNo: number | null;
  orderId: string;
  shopName: string;
  area: string;
  supplierName: string | null;
  orderStatus: string;
  voided: boolean;
}

export interface RxSearch {
  sph: number | null;
  /** 0 searches for "no CYL", as a zero is stored. */
  cyl: number | null;
  add: number | null;
  shop: string;
  status: RxStatus | "all";
}

/** The most jobs one search returns; narrow by power or shop to see more. */
export const RX_LIMIT = 200;

/** RX jobs matching a search, newest first. */
export async function listRxJobs(search: RxSearch): Promise<RxJob[]> {
  const { supabase } = await requireUser();

  // A shop search narrows to that shop's orders first, so the limit below
  // applies to its jobs rather than to everyone's.
  let orderIds: string[] | null = null;
  if (search.shop) {
    const pattern = `%${search.shop.replace(/[%_\\]/g, "\\$&")}%`;
    const { data: customers, error } = await supabase
      .from("customers")
      .select("id")
      .ilike("shop_name", pattern);
    if (error) throw new Error(describePostgresError(error, "search RX jobs"));
    if (!customers?.length) return [];

    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .in(
        "bill_to_customer_id",
        customers.map((c) => c.id),
      );
    if (orderError) {
      throw new Error(describePostgresError(orderError, "search RX jobs"));
    }
    orderIds = (orders ?? []).map((o) => o.id);
    if (orderIds.length === 0) return [];
  }

  let query = supabase
    .from("order_lines")
    .select("*")
    .not("rx_status", "is", null)
    .order("created_at", { ascending: false })
    .limit(RX_LIMIT);

  if (search.status !== "all") query = query.eq("rx_status", search.status);
  if (search.sph !== null) query = query.eq("sph", search.sph);
  if (search.cyl !== null) {
    query =
      search.cyl === 0 ? query.is("cyl", null) : query.eq("cyl", search.cyl);
  }
  if (search.add !== null) {
    query =
      search.add === 0
        ? query.is("add_power", null)
        : query.eq("add_power", search.add);
  }
  if (orderIds) query = query.in("order_id", orderIds);

  const { data: lines, error } = await query;
  if (error) throw new Error(describePostgresError(error, "load RX jobs"));
  if (!lines || lines.length === 0) return [];

  const supplierIds = [
    ...new Set(lines.map((l) => l.supplier_id).filter((id) => id !== null)),
  ];

  const [orders, suppliers] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_no, invoice_no, status, voided_at, bill_to_customer_id",
      )
      .in("id", [...new Set(lines.map((l) => l.order_id))]),
    supplierIds.length
      ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (orders.error) {
    throw new Error(describePostgresError(orders.error, "load RX jobs"));
  }
  if (suppliers.error) {
    throw new Error(describePostgresError(suppliers.error, "load RX jobs"));
  }

  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("id, shop_name, area")
    .in("id", [
      ...new Set((orders.data ?? []).map((o) => o.bill_to_customer_id)),
    ]);
  if (customerError) {
    throw new Error(describePostgresError(customerError, "load RX jobs"));
  }

  const orderById = new Map((orders.data ?? []).map((o) => [o.id, o]));
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const supplierById = new Map(
    (suppliers.data ?? []).map((s) => [s.id, s.name]),
  );

  return lines.map((line) => {
    const order = orderById.get(line.order_id);
    const customer = order
      ? customerById.get(order.bill_to_customer_id)
      : undefined;
    return {
      ...line,
      orderId: line.order_id,
      orderNo: order?.order_no ?? 0,
      invoiceNo: order?.invoice_no ?? null,
      shopName: customer?.shop_name ?? "—",
      area: customer?.area ?? "",
      supplierName: line.supplier_id
        ? (supplierById.get(line.supplier_id) ?? null)
        : null,
      orderStatus: order?.status ?? "created",
      voided: Boolean(order?.voided_at),
    };
  });
}

/** Mark an RX lens as back from the lab, or undo that. */
export async function setRxReceived(
  lineId: string,
  received: boolean,
): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("order_lines")
    .update({
      rx_status: received ? "received" : "ordered",
      received_at: received ? new Date().toISOString() : null,
    })
    .eq("id", lineId)
    .not("rx_status", "is", null);

  if (error) {
    throw new Error(describePostgresError(error, "update the RX job"));
  }
  logger.info("RX job updated", { lineId, received });
}

/** RX sales, cost and profit for the latest months, newest first. */
export async function listRxMonthly(limit = 12): Promise<RxMonth[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("rx_monthly")
    .select("*")
    .order("month", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(describePostgresError(error, "load RX monthly figures"));
  }
  return data ?? [];
}
