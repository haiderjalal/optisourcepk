import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type {
  IssueInvoicePayload,
  OrderPayload,
} from "@/lib/validations/shop/invoice";
import type { Customer, Order, OrderLine } from "@/types/database";
import { describePostgresError } from "./errors";
import { resolveRxProducts, rxProductId } from "./product.service";

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

/**
 * The RX job card fields — sent only for an RX order. A stock order sends
 * none of them, so it saves even on a database that has not had the RX
 * migrations yet.
 */
function rxCard(payload: OrderPayload) {
  if (!payload.isRx) return {};
  return {
    patient_name: optional(payload.patientName),
    lab_order_no: optional(payload.labOrderNo),
    rx_lens_type: payload.rxLensType ? payload.rxLensType : null,
    rx_tint_reason: optional(payload.rxTintReason),
    frame_material: payload.frameMaterial ? payload.frameMaterial : null,
    frame_type: payload.frameType ? payload.frameType : null,
  };
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
      ...rxCard(payload),
      ...(payload.isRx ? { is_rx: true } : {}),
      ...(payload.isDaily ? { is_daily: true } : {}),
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
      ...rxCard(payload),
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

  // Lines are replaced wholesale, so an RX lens already back from the lab
  // would lose its "received" mark on every edit. Carry it over by position.
  const { data: previous, error: readError } = payload.isRx
    ? await supabase
        .from("order_lines")
        .select("product_id, sph, cyl, add_power, eye, rx_status, received_at")
        .eq("order_id", orderId)
    : { data: [], error: null };

  if (readError) {
    throw new Error(describePostgresError(readError, "update the lines"));
  }

  const positionOf = (l: {
    product_id: string;
    sph: number | null;
    cyl: number | null;
    add_power: number | null;
    eye: string | null;
  }) => [l.product_id, l.sph, l.cyl, l.add_power, l.eye].join("|");

  const received = new Map<string, string[]>();
  for (const line of previous ?? []) {
    if (line.rx_status !== "received" || !line.received_at) continue;
    const list = received.get(positionOf(line)) ?? [];
    list.push(line.received_at);
    received.set(positionOf(line), list);
  }

  // Typed RX product names become products first, before any line is touched.
  const typed = payload.lines
    .filter((line) => !line.productId && line.productName)
    .map((line) => line.productName ?? "");
  const typedIds = await resolveRxProducts(typed);
  const productIdOf = (line: OrderPayload["lines"][number]) =>
    line.productId ??
    (line.productName ? rxProductId(typedIds, line.productName) : undefined);

  const { error: clearError } = await supabase
    .from("order_lines")
    .delete()
    .eq("order_id", orderId);

  if (clearError) {
    throw new Error(describePostgresError(clearError, "update the lines"));
  }

  // Snapshot the product name at this moment: a later rename must not rewrite
  // an order that has already been printed or sent.
  const productIds = [
    ...new Set(payload.lines.map(productIdOf).filter((id) => id !== undefined)),
  ];
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, unit, tracks_power")
    .in("id", productIds);

  if (productError) {
    throw new Error(describePostgresError(productError, "read the products"));
  }

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const rows = payload.lines.map((line, index) => {
    const productId = productIdOf(line);
    const product = productId ? byId.get(productId) : undefined;
    if (!product) {
      throw new Error("One of those products no longer exists.");
    }
    // A lens always has an SPH, and every lens bin is held at one, so a blank
    // SPH is plano (0.00) — otherwise the line matches no stock.
    // Every line of an RX order is a lab job, and only those.
    const rx = payload.isRx;
    const sph = line.sph ?? (product.tracks_power || rx ? 0 : null);
    // Zero cylinder or addition means none: stored as NULL so it prints
    // blank, and so it matches a stock bin received the same way.
    const cyl = line.cyl === 0 ? null : line.cyl;
    const addPower = line.addPower === 0 ? null : line.addPower;
    const eye = line.eye === "" || !line.eye ? null : line.eye;
    const receivedAt = rx
      ? (received
          .get(
            positionOf({
              product_id: product.id,
              sph,
              cyl,
              add_power: addPower,
              eye,
            }),
          )
          ?.shift() ?? null)
      : null;

    return {
      order_id: orderId,
      line_no: index + 1,
      // On an RX order the patient's name is the reference, so it prints on
      // the invoice against each lens.
      order_ref:
        optional(line.orderRef) ??
        optional(payload.externalOrderRef) ??
        (payload.isRx ? optional(payload.patientName) : null),
      product_id: product.id,
      product_name: product.name,
      unit: product.unit,
      eye,
      sph,
      cyl,
      // CYL 0 is stored as none, and an axis means nothing without a
      // cylinder — the database refuses the pair — so it goes with it.
      ax: cyl === null ? null : line.ax,
      add_power: addPower,
      unit_price: line.unitPrice,
      discount_pct: line.discountPct,
      quantity: line.quantity,
      // A daily order keeps its purchase price for the day's profit.
      ...(payload.isDaily && !rx ? { unit_cost: line.unitCost } : {}),
      // The lab job fields exist only on RX lines.
      ...(rx
        ? {
            unit_cost: line.unitCost,
            supplier_id: line.supplierId,
            rx_dia: line.rxDia,
            rx_base: line.rxBase,
            rx_fitting_height: line.rxFittingHeight,
            rx_prism: line.rxPrism,
            rx_ipd: line.rxIpd,
            rx_status: receivedAt
              ? ("received" as const)
              : ("ordered" as const),
            received_at: receivedAt,
          }
        : {}),
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
  /** `false` for stock orders only, `true` for RX only; omit for both. */
  rx?: boolean;
  limit?: number;
}

export async function listOrders({
  issued,
  rx,
  limit = 100,
}: ListOrdersOptions = {}): Promise<Order[]> {
  const { supabase } = await requireUser();

  let query = supabase.from("orders").select("*").limit(limit);
  if (rx !== undefined) query = query.eq("is_rx", rx);

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

/** Reverse an issued invoice and return the same order as an editable draft. */
export async function reopenInvoice(orderId: string): Promise<Order> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("reopen_invoice", {
    p_order_id: orderId,
  });
  if (error)
    throw new Error(describePostgresError(error, "reopen the invoice"));

  logger.warn("Invoice reopened for editing", { orderId });
  return data;
}

/** Delete an invoice after the database reverses its stock and ledger posts. */
export async function deleteInvoice(orderId: string): Promise<void> {
  const { supabase } = await requireUser();

  // Kept in Recently deleted for 7 days, with its stock and ledger postings.
  const { error } = await supabase.rpc("trash_order", {
    p_order_id: orderId,
  });
  if (error)
    throw new Error(describePostgresError(error, "delete the invoice"));

  logger.warn("Invoice moved to Recently deleted", { orderId });
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
    .select("id, order_no, invoice_no, issued_at, billed_in")
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
  if (order.billed_in !== null) {
    throw new Error(
      "This RX order is already on an invoice, so it cannot be deleted.",
    );
  }

  // Kept in Recently deleted for 7 days.
  const { error } = await supabase.rpc("trash_order", { p_order_id: id });

  if (error) throw new Error(describePostgresError(error, "delete the order"));

  logger.info("Draft order moved to Recently deleted", {
    orderId: id,
    orderNo: order.order_no,
  });
}

/**
 * Remove a draft that was never really made — the half-saved order left
 * when issuing a daily order fails. Not a user's delete, so it skips the bin.
 */
async function discardOrder(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) logger.error("Could not discard a failed order", { orderId: id });
}

/**
 * Save a daily order and issue its invoice at once — a counter sale from the
 * daily register. If the invoice cannot be issued (say the register is short),
 * the order is removed again, so a failed save leaves nothing behind to
 * double up on a retry.
 */
export async function createDailyOrder(payload: OrderPayload): Promise<Order> {
  const order = await createOrder({ ...payload, isDaily: true });
  try {
    return await issueInvoice({
      orderId: order.id,
      freight: 0,
      gstRate: 0,
      additionalTaxRate: 0,
    });
  } catch (error) {
    await discardOrder(order.id);
    throw error;
  }
}
