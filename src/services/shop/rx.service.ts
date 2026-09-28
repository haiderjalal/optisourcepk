import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { OrderLine, RxMonth, RxStage, RxStatus } from "@/types/database";
import { pairEyes } from "@/features/shop/rx/pairs";
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
  rxNo: number | null;
  patientName: string | null;
  rxStage: RxStage | null;
  rxSentAt: string | null;
  rxBackAt: string | null;
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

/**
 * RX jobs matching a search, newest first — one row per job, the R and L of
 * the same product on the same order together.
 */
export async function listRxJobs(search: RxSearch): Promise<RxJob[][]> {
  const { supabase } = await requireUser();

  // A name search narrows to the matching orders first — by the shop's name
  // or the patient's — so the limit below applies to their jobs, not everyone's.
  let orderIds: string[] | null = null;
  if (search.shop) {
    const pattern = `%${search.shop.replace(/[%_\\]/g, "\\$&")}%`;
    const { data: customers, error } = await supabase
      .from("customers")
      .select("id")
      .ilike("shop_name", pattern);
    if (error) throw new Error(describePostgresError(error, "search RX jobs"));

    const [byShop, byPatient] = await Promise.all([
      customers?.length
        ? supabase
            .from("orders")
            .select("id")
            .eq("is_rx", true)
            .in(
              "bill_to_customer_id",
              customers.map((c) => c.id),
            )
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("orders")
        .select("id")
        .eq("is_rx", true)
        .ilike("patient_name", pattern),
    ]);
    if (byShop.error || byPatient.error) {
      throw new Error(
        describePostgresError(
          byShop.error ?? byPatient.error,
          "search RX jobs",
        ),
      );
    }
    orderIds = [
      ...new Set(
        [...(byShop.data ?? []), ...(byPatient.data ?? [])].map((o) => o.id),
      ),
    ];
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

  const { data: matched, error } = await query;
  if (error) throw new Error(describePostgresError(error, "load RX jobs"));
  if (!matched || matched.length === 0) return [];

  // A search can hit one eye only; read the rest of those orders' RX lines so
  // each lens is shown with its partner.
  const { data: siblings, error: siblingError } = await supabase
    .from("order_lines")
    .select("*")
    .not("rx_status", "is", null)
    .in("order_id", [...new Set(matched.map((l) => l.order_id))]);
  if (siblingError) {
    throw new Error(describePostgresError(siblingError, "load RX jobs"));
  }

  const matchedIds = new Set(matched.map((l) => l.id));
  const extra = (siblings ?? []).filter((l) => !matchedIds.has(l.id));
  const lines = [...matched, ...extra];

  const supplierIds = [
    ...new Set(lines.map((l) => l.supplier_id).filter((id) => id !== null)),
  ];

  const [orders, suppliers] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_no, invoice_no, status, voided_at, bill_to_customer_id, rx_no, patient_name, rx_stage, rx_sent_at, rx_back_at",
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

  const jobs = lines.map((line): RxJob => {
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
      rxNo: order?.rx_no ?? null,
      patientName: order?.patient_name ?? null,
      rxStage: order?.rx_stage ?? null,
      rxSentAt: order?.rx_sent_at ?? null,
      rxBackAt: order?.rx_back_at ?? null,
    };
  });

  return pairEyes(jobs, matchedIds);
}

/**
 * Move an RX order through the lab: booked, sent to lab, back from lab. Both
 * eyes move together; the invoice can be issued once it is back.
 */
export async function setRxStage(
  orderId: string,
  stage: RxStage,
): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("set_rx_stage", {
    p_order_id: orderId,
    p_stage: stage,
  });

  if (error) {
    throw new Error(describePostgresError(error, "update the RX order"));
  }
  logger.info("RX stage set", { orderId, stage });
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
