import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type {
  Order,
  OrderLine,
  RxMonth,
  RxStage,
  RxStatus,
} from "@/types/database";
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
  customerId: string;
  shopName: string;
  area: string;
  supplierName: string | null;
  orderStatus: string;
  voided: boolean;
  rxNo: number | null;
  patientName: string | null;
  opticianName: string | null;
  labOrderNo: string | null;
  rxStage: RxStage | null;
  rxSentAt: string | null;
  rxBackAt: string | null;
  /** The combined invoice this RX order was billed on, if any. */
  billedIn: string | null;
}

export interface RxSearch {
  sph: number | null;
  /** 0 searches for "no CYL", as a zero is stored. */
  cyl: number | null;
  add: number | null;
  shop: string;
  /** An RX number (RX006 → 6) finds that one order, whatever its status. */
  rxNo: number | null;
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
  if (search.rxNo !== null) {
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("is_rx", true)
      .eq("rx_no", search.rxNo);
    if (error) throw new Error(describePostgresError(error, "search RX jobs"));
    orderIds = (data ?? []).map((o) => o.id);
    if (orderIds.length === 0) return [];
  }
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
    const byName = new Set(
      [...(byShop.data ?? []), ...(byPatient.data ?? [])].map((o) => o.id),
    );
    orderIds = orderIds ? orderIds.filter((id) => byName.has(id)) : [...byName];
    if (orderIds.length === 0) return [];
  }

  let query = supabase
    .from("order_lines")
    .select("*")
    .not("rx_status", "is", null)
    .order("created_at", { ascending: false })
    .limit(RX_LIMIT);

  // Looking up one RX number shows it whatever its status.
  if (search.status !== "all" && search.rxNo === null) {
    query = query.eq("rx_status", search.status);
  }
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
        "id, order_no, invoice_no, status, voided_at, bill_to_customer_id, rx_no, patient_name, order_by_name, lab_order_no, rx_stage, rx_sent_at, rx_back_at, billed_in, combines_rx",
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

  // A billed RX order shows the combined invoice it went on.
  const billedIds = [
    ...new Set(
      (orders.data ?? []).map((o) => o.billed_in).filter((id) => id !== null),
    ),
  ];
  const billedNo = new Map<string, number | null>();
  if (billedIds.length > 0) {
    const { data: billed, error: billedError } = await supabase
      .from("orders")
      .select("id, invoice_no")
      .in("id", billedIds);
    if (billedError) {
      throw new Error(describePostgresError(billedError, "load RX jobs"));
    }
    for (const b of billed ?? []) billedNo.set(b.id, b.invoice_no);
  }
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const supplierById = new Map(
    (suppliers.data ?? []).map((s) => [s.id, s.name]),
  );

  // A combined invoice's lines are copies of RX orders already listed.
  // ponytail: filtered after the limit, so a page can come back a little short.
  const ownLines = lines.filter(
    (line) => !orderById.get(line.order_id)?.combines_rx,
  );

  const jobs = ownLines.map((line): RxJob => {
    const order = orderById.get(line.order_id);
    const customer = order
      ? customerById.get(order.bill_to_customer_id)
      : undefined;
    return {
      ...line,
      orderId: line.order_id,
      customerId: order?.bill_to_customer_id ?? "",
      orderNo: order?.order_no ?? 0,
      invoiceNo:
        order?.invoice_no ??
        (order?.billed_in ? (billedNo.get(order.billed_in) ?? null) : null),
      billedIn: order?.billed_in ?? null,
      shopName: customer?.shop_name ?? "—",
      area: customer?.area ?? "",
      supplierName: line.supplier_id
        ? (supplierById.get(line.supplier_id) ?? null)
        : null,
      orderStatus: order?.status ?? "created",
      voided: Boolean(order?.voided_at),
      rxNo: order?.rx_no ?? null,
      patientName: order?.patient_name ?? null,
      opticianName: order?.order_by_name ?? null,
      labOrderNo: order?.lab_order_no ?? null,
      rxStage: order?.rx_stage ?? null,
      rxSentAt: order?.rx_sent_at ?? null,
      rxBackAt: order?.rx_back_at ?? null,
    };
  });

  return pairEyes(jobs, matchedIds);
}

export interface RxSameDayJob {
  order: Order;
  lines: OrderLine[];
}

/** The Karachi calendar day an instant falls on, as its start and end. */
function karachiDay(at: string): { from: string; to: string } {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
  }).format(new Date(at));
  const next = new Date(`${day}T00:00:00+05:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { from: `${day}T00:00:00+05:00`, to: next.toISOString() };
}

/**
 * Every RX order for the same patient at the same optician booked the same
 * day — this one included — so the lab gets them in one message. Matched by
 * name, ignoring case and spacing; voided orders are left out.
 */
export async function listSamePatientSameDay(
  order: Order,
): Promise<RxSameDayJob[]> {
  const { supabase } = await requireUser();

  const patient = order.patient_name?.trim().replace(/\s+/g, " ");
  const { from, to } = karachiDay(order.created_at);

  let query = supabase
    .from("orders")
    .select("*")
    .eq("is_rx", true)
    .eq("bill_to_customer_id", order.bill_to_customer_id)
    .is("voided_at", null)
    .gte("created_at", from)
    .lt("created_at", to)
    .order("rx_no");
  // No patient name: nothing to match on, so just this order.
  query = patient
    ? query.ilike("patient_name", patient.replace(/[%_\\]/g, "\\$&"))
    : query.eq("id", order.id);

  const { data: orders, error } = await query;
  if (error)
    throw new Error(describePostgresError(error, "load the patient's orders"));

  const same = (orders ?? []).filter(
    (o) =>
      o.id === order.id ||
      o.patient_name?.trim().replace(/\s+/g, " ").toLowerCase() ===
        patient?.toLowerCase(),
  );
  if (!same.some((o) => o.id === order.id)) same.push(order);

  const { data: lines, error: lineError } = await supabase
    .from("order_lines")
    .select("*")
    .in(
      "order_id",
      same.map((o) => o.id),
    )
    .order("line_no");
  if (lineError) {
    throw new Error(
      describePostgresError(lineError, "load the patient's orders"),
    );
  }

  return same
    .sort((a, b) => (a.rx_no ?? 0) - (b.rx_no ?? 0))
    .map((o) => ({
      order: o,
      lines: (lines ?? []).filter((l) => l.order_id === o.id),
    }));
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

/** Save the lab's reference without changing prices, stage, or invoicing. */
export async function updateRxLabOrderNo(
  orderId: string,
  labOrderNo: string,
): Promise<void> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("orders")
    .update({ lab_order_no: labOrderNo.trim() })
    .eq("id", orderId)
    .eq("is_rx", true)
    .in("rx_stage", ["sent", "back"])
    .is("issued_at", null)
    .is("voided_at", null)
    .is("billed_in", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(describePostgresError(error, "save the lab order number"));
  }
  if (!data) {
    throw new Error(
      "Send the RX order to the lab before adding its lab order number.",
    );
  }

  logger.info("RX lab order number saved", { orderId });
}

export interface RxPricing {
  orderId: string;
  /** Per lens. */
  salePrice: number;
  purchasePrice: number | null;
  labOrderNo: string | null;
}

/**
 * Enter an RX order's prices. The lens is in hand, so it is marked back from
 * the lab; it is then ready for the shop's combined invoice.
 */
export async function priceRx(pricing: RxPricing): Promise<void> {
  const { supabase } = await requireUser();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, is_rx, issued_at, voided_at, billed_in, rx_stage")
    .eq("id", pricing.orderId)
    .maybeSingle();
  if (error) throw new Error(describePostgresError(error, "load the RX order"));
  if (!order?.is_rx) throw new Error("That is not an RX order.");
  if (order.issued_at || order.voided_at || order.billed_in) {
    throw new Error("This RX order is already invoiced.");
  }

  const { error: referenceError } = await supabase
    .from("orders")
    .update({ lab_order_no: pricing.labOrderNo })
    .eq("id", pricing.orderId);
  if (referenceError) {
    throw new Error(
      describePostgresError(referenceError, "save the lab order number"),
    );
  }

  const { error: priceError } = await supabase
    .from("order_lines")
    .update({
      unit_price: pricing.salePrice,
      unit_cost: pricing.purchasePrice,
    })
    .eq("order_id", pricing.orderId)
    .not("rx_status", "is", null);
  if (priceError) {
    throw new Error(describePostgresError(priceError, "save the RX prices"));
  }

  if (order.rx_stage !== "back") await setRxStage(pricing.orderId, "back");
  logger.info("RX priced", { orderId: pricing.orderId });
}

export interface ReadyRxOrder {
  id: string;
  rxNo: number | null;
  patientName: string | null;
  labOrderNo: string | null;
  externalRef: string | null;
  total: number;
  /** Every lens has a sale price. */
  priced: boolean;
}

export interface ReadyShop {
  customerId: string;
  shopName: string;
  orders: ReadyRxOrder[];
  total: number;
}

/**
 * RX orders back from the lab and not yet invoiced, grouped by shop — what
 * "Generate invoice" will put on each shop's one invoice.
 */
export async function listReadyToInvoice(): Promise<ReadyShop[]> {
  const { supabase } = await requireUser();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, rx_no, patient_name, lab_order_no, external_order_ref, bill_to_customer_id",
    )
    .eq("is_rx", true)
    .eq("rx_stage", "back")
    .is("issued_at", null)
    .is("voided_at", null)
    .is("billed_in", null)
    .order("rx_no");
  if (error) {
    throw new Error(describePostgresError(error, "load RX orders to invoice"));
  }
  if (!orders || orders.length === 0) return [];

  const [lines, customers] = await Promise.all([
    supabase
      .from("order_lines")
      .select("order_id, unit_price, line_total")
      .in(
        "order_id",
        orders.map((o) => o.id),
      ),
    supabase
      .from("customers")
      .select("id, shop_name")
      .in("id", [...new Set(orders.map((o) => o.bill_to_customer_id))]),
  ]);
  if (lines.error || customers.error) {
    throw new Error(
      describePostgresError(
        lines.error ?? customers.error,
        "load RX orders to invoice",
      ),
    );
  }

  const shopName = new Map(
    (customers.data ?? []).map((c) => [c.id, c.shop_name]),
  );
  const byShop = new Map<string, ReadyShop>();

  for (const order of orders) {
    const own = (lines.data ?? []).filter((l) => l.order_id === order.id);
    const total = own.reduce((sum, l) => sum + l.line_total, 0);
    const shop = byShop.get(order.bill_to_customer_id) ?? {
      customerId: order.bill_to_customer_id,
      shopName: shopName.get(order.bill_to_customer_id) ?? "—",
      orders: [],
      total: 0,
    };
    shop.orders.push({
      id: order.id,
      rxNo: order.rx_no,
      patientName: order.patient_name,
      labOrderNo: order.lab_order_no,
      externalRef: order.external_order_ref,
      total,
      priced: own.length > 0 && own.every((l) => l.unit_price > 0),
    });
    shop.total += total;
    byShop.set(order.bill_to_customer_id, shop);
  }

  return [...byShop.values()].sort((a, b) =>
    a.shopName.localeCompare(b.shopName),
  );
}

/**
 * One invoice for all of a shop's ready RX orders, posted to its ledger.
 * Returns the new invoice's order id.
 */
export async function issueRxInvoice(customerId: string): Promise<string> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("issue_rx_invoice", {
    p_customer_id: customerId,
  });
  if (error) throw new Error(describePostgresError(error, "issue the invoice"));

  logger.info("RX invoice issued", {
    customerId,
    invoiceNo: data.invoice_no,
  });
  return data.id;
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
