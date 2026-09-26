import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type {
  IssueInvoicePayload,
  OrderPayload,
} from "@/lib/validations/shop/invoice";
import type { Customer, Order, OrderLine } from "@/types/database";
import { describePostgresError } from "./errors";

/**
 * Orders and invoices.
 *
 * An invoice is an order that has been issued — same row, same lines. Issuing
 * is the one operation that must be atomic (stock, numbering, totals and the
 * ledger all move together), so it lives in the `issue_invoice` function and
 * this layer only calls it and translates what comes back.
 */

export interface OrderWithLines extends Order {
  lines: OrderLine[];
  customer: Customer | null;
}

/** Blank from a form means "not given", not "set to empty". */
function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createOrder(payload: OrderPayload): Promise<Order> {
  const { supabase } = await requireUser();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      bill_to_customer_id: payload.customerId,
      external_order_ref: optional(payload.externalOrderRef),
      priority: payload.priority,
      order_by_name: optional(payload.orderByName),
      deliver_to_name: optional(payload.deliverToName),
      deliver_to_address: optional(payload.deliverToAddress),
      deliver_to_area: optional(payload.deliverToArea),
      deliver_to_phone: optional(payload.deliverToPhone),
      courier_name: optional(payload.courierName),
      tracking_no: optional(payload.trackingNo),
      notes: optional(payload.notes),
    })
    .select()
    .single();

  if (error) throw new Error(describePostgresError(error, "save the order"));

  try {
    await replaceLines(order.id, payload);
  } catch (lineError) {
    // The header is useless without its lines, and PostgREST gives us no
    // transaction across two calls — so undo it rather than leave a husk.
    await supabase.from("orders").delete().eq("id", order.id);
    throw lineError;
  }

  logger.info("Order created", {
    orderId: order.id,
    lines: payload.lines.length,
  });
  return order;
}

export async function updateOrder(
  id: string,
  payload: OrderPayload,
): Promise<Order> {
  const { supabase } = await requireUser();

  const { data: order, error } = await supabase
    .from("orders")
    .update({
      bill_to_customer_id: payload.customerId,
      external_order_ref: optional(payload.externalOrderRef),
      priority: payload.priority,
      order_by_name: optional(payload.orderByName),
      deliver_to_name: optional(payload.deliverToName),
      deliver_to_address: optional(payload.deliverToAddress),
      deliver_to_area: optional(payload.deliverToArea),
      deliver_to_phone: optional(payload.deliverToPhone),
      courier_name: optional(payload.courierName),
      tracking_no: optional(payload.trackingNo),
      notes: optional(payload.notes),
    })
    .eq("id", id)
    .select()
    .single();

  // The freeze trigger refuses this once the invoice is issued, and says so.
  if (error) throw new Error(describePostgresError(error, "save the order"));

  await replaceLines(id, payload);

  logger.info("Order updated", { orderId: id });
  return order;
}

/**
 * Replace every line on an order.
 *
 * Simpler than diffing, and safe because an issued order's lines are frozen by
 * the database — so this can only ever run on a draft.
 */
async function replaceLines(
  orderId: string,
  payload: OrderPayload,
): Promise<void> {
  const { supabase } = await requireUser();

  const { error: clearError } = await supabase
    .from("order_lines")
    .delete()
    .eq("order_id", orderId);

  if (clearError) {
    throw new Error(describePostgresError(clearError, "update the lines"));
  }

  // Snapshot the product name at this moment: a later rename must not rewrite
  // an order that has already been printed or sent.
  const productIds = [...new Set(payload.lines.map((line) => line.productId))];
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, unit, tracks_power")
    .in("id", productIds);

  if (productError) {
    throw new Error(describePostgresError(productError, "read the products"));
  }

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const rows = payload.lines.map((line, index) => {
    const product = byId.get(line.productId);
    if (!product) {
      throw new Error("One of those products no longer exists.");
    }
    return {
      order_id: orderId,
      line_no: index + 1,
      order_ref: optional(line.orderRef) ?? optional(payload.externalOrderRef),
      product_id: line.productId,
      product_name: product.name,
      unit: product.unit,
      eye: line.eye === "" || !line.eye ? null : line.eye,
      // A lens always has an SPH, and every lens bin is held at one, so a
      // blank SPH is plano (0.00) — otherwise the line matches no stock.
      sph: line.sph ?? (product.tracks_power ? 0 : null),
      // Zero cylinder or addition means none: stored as NULL so it prints
      // blank, and so it matches a stock bin received the same way.
      cyl: line.cyl === 0 ? null : line.cyl,
      ax: line.ax,
      add_power: line.addPower === 0 ? null : line.addPower,
      unit_price: line.unitPrice,
      discount_pct: line.discountPct,
      quantity: line.quantity,
    };
  });

  const { error: insertError } = await supabase
    .from("order_lines")
    .insert(rows);
  if (insertError) {
    throw new Error(describePostgresError(insertError, "save the lines"));
  }
}

export async function getOrder(id: string): Promise<OrderWithLines | null> {
  const { supabase } = await requireUser();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(describePostgresError(error, "load the order"));
  if (!order) return null;

  const [lines, customer] = await Promise.all([
    supabase
      .from("order_lines")
      .select("*")
      .eq("order_id", id)
      .order("line_no"),
    supabase
      .from("customers")
      .select("*")
      .eq("id", order.bill_to_customer_id)
      .maybeSingle(),
  ]);

  if (lines.error) {
    throw new Error(describePostgresError(lines.error, "load the lines"));
  }

  return {
    ...order,
    lines: lines.data ?? [],
    customer: customer.data ?? null,
  };
}

export interface ListOrdersOptions {
  /** `true` for issued invoices, `false` for open drafts. */
  issued?: boolean;
  limit?: number;
}

export async function listOrders({
  issued,
  limit = 100,
}: ListOrdersOptions = {}): Promise<Order[]> {
  const { supabase } = await requireUser();

  let query = supabase.from("orders").select("*").limit(limit);

  query =
    issued === true
      ? query
          .not("issued_at", "is", null)
          .order("invoice_no", { ascending: false })
      : issued === false
        ? query.is("issued_at", null).order("created_at", { ascending: false })
        : query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(describePostgresError(error, "load orders"));
  return data ?? [];
}

/**
 * Issue the invoice.
 *
 * One transaction in the database: stock comes off the bins, the number is
 * taken, the totals are computed from the lines it holds — not from anything
 * sent from here — and the ledger entry is posted. If any part fails, none of
 * it happened.
 */
export async function issueInvoice(
  payload: IssueInvoicePayload,
): Promise<Order> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("issue_invoice", {
    p_order_id: payload.orderId,
    p_freight: payload.freight,
    p_gst_rate: payload.gstRate,
    p_additional_tax_rate: payload.additionalTaxRate,
  });

  if (error) throw new Error(describePostgresError(error, "issue the invoice"));

  logger.info("Invoice issued", {
    orderId: payload.orderId,
    invoiceNo: data.invoice_no,
  });

  return data;
}

/** Return the stock and reverse the ledger. Issued invoices cannot be edited. */
export async function voidInvoice(
  orderId: string,
  reason: string,
): Promise<Order> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("void_invoice", {
    p_order_id: orderId,
    p_reason: reason,
  });

  if (error) throw new Error(describePostgresError(error, "void the invoice"));

  logger.warn("Invoice voided", { orderId, reason });
  return data;
}

export interface DeliveryUpdate {
  orderId: string;
  status: "dispatched" | "delivered";
  courierName?: string | null;
  trackingNo?: string | null;
  deliveredBy?: string | null;
  note?: string | null;
}

/** Move an order along its lifecycle. Allowed even on an issued invoice. */
export async function updateDelivery(update: DeliveryUpdate): Promise<Order> {
  const { supabase } = await requireUser();

  const now = new Date().toISOString();

  let patch;
  if (update.status === "dispatched") {
    patch = {
      status: "dispatched" as const,
      dispatched_at: now,
      courier_name: update.courierName ?? null,
      tracking_no: update.trackingNo ?? null,
    };
  } else {
    // The database requires a dispatch timestamp on anything delivered. A
    // worker reporting "delivered" on an order that was never marked
    // dispatched is normal — back-fill it rather than refuse the report.
    const { data: existing } = await supabase
      .from("orders")
      .select("dispatched_at")
      .eq("id", update.orderId)
      .maybeSingle();

    patch = {
      status: "delivered" as const,
      dispatched_at: existing?.dispatched_at ?? now,
      delivered_at: now,
      delivered_by: update.deliveredBy ?? null,
      delivery_note: update.note ?? null,
    };
  }

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", update.orderId)
    .select()
    .single();

  if (error) {
    throw new Error(describePostgresError(error, "update the delivery"));
  }

  logger.info("Delivery updated", {
    orderId: update.orderId,
    status: update.status,
  });
  return data;
}

/**
 * Delete a draft order outright.
 *
 * Only ever a draft. An issued invoice is a business record — it is voided,
 * which returns the stock and reverses the ledger while keeping the document
 * and its number on file. The database enforces this too: ledger entries and
 * stock movements reference the order with ON DELETE RESTRICT, so anything
 * that has actually moved money or stock cannot be deleted even by mistake.
 *
 * Lines cascade with the order.
 */
export async function deleteOrder(id: string): Promise<void> {
  const { supabase } = await requireUser();

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, order_no, invoice_no, issued_at")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    throw new Error(describePostgresError(readError, "load the order"));
  }
  if (!order) return;

  if (order.issued_at !== null) {
    throw new Error(
      `Invoice ${order.invoice_no} has been issued, so it cannot be deleted. Void it instead — that returns the stock and credits the customer, and keeps the invoice on record.`,
    );
  }

  const { error } = await supabase.from("orders").delete().eq("id", id);

  if (error) throw new Error(describePostgresError(error, "delete the order"));

  logger.info("Draft order deleted", { orderId: id, orderNo: order.order_no });
}
