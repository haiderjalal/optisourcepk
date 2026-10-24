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
import { chunk } from "@/lib/utils";
import { PAGE_SIZE } from "./paging";

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
  rxOnHold: boolean;
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
  /** Part of the lab's order number; finds those orders, whatever their status. */
  labOrder: string;
  status: RxStatus | "all";
}

/** Orders whose lines are read in one request when filling in a job's partner lens. */
const SIBLING_GROUP = 100;

/**
 * RX jobs matching a search, newest first — one row per job, the R and L of
 * the same product on the same order together.
 */
export async function listRxJobs(
  search: RxSearch,
  limit = 6,
): Promise<RxJob[][]> {
  const { supabase } = await requireUser();

  // A name search narrows to the matching orders first — by the shop's name
  // or the patient's — so the limit below applies to their jobs, not everyone's.
  let orderIds: string[] | null = null;
  if (search.labOrder) {
    const pattern = `%${search.labOrder.replace(/[%_\\]/g, "\\$&")}%`;
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("is_rx", true)
      .ilike("lab_order_no", pattern);
    if (error) throw new Error(describePostgresError(error, "search RX jobs"));
    orderIds = (data ?? []).map((o) => o.id);
    if (orderIds.length === 0) return [];
  }
  if (search.rxNo !== null) {
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("is_rx", true)
      .eq("rx_no", search.rxNo);
    if (error) throw new Error(describePostgresError(error, "search RX jobs"));
    // Both boxes filled: the order must match both.
    const byRx = (data ?? []).map((o) => o.id);
    orderIds = orderIds ? orderIds.filter((id) => byRx.includes(id)) : byRx;
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

  // Each page of lines is read with the same filters, built afresh.
  const linesQuery = () => {
    let query = supabase
      .from("order_lines")
      .select("*")
      .not("rx_status", "is", null)
      .order("created_at", { ascending: false })
      .order("id");

    // Looking up one RX number shows it whatever its status.
    if (search.status !== "all" && search.rxNo === null && !search.labOrder) {
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
    return query;
  };

  // A combined invoice's lines are copies of RX orders, and they are newer
  // than the orders themselves — so they are skipped while reading, and the
  // reading carries on until there is a full page of real jobs. Skipping them
  // after a single limited read is what left "Show 5 more" showing nothing.
  const wantedLines = limit * 2; // two eyes make one row, near enough
  // The server returns at most PAGE_SIZE rows a request. A larger page comes
  // back short and reads as the end of the lines, which cut the list short.
  const batch = Math.min(Math.max(wantedLines, 200), PAGE_SIZE);
  const combined = new Set<string>();
  const known = new Set<string>();
  const matched: OrderLine[] = [];

  for (let from = 0, pages = 0; pages < 25; pages++, from += batch) {
    const { data, error } = await linesQuery().range(from, from + batch - 1);
    if (error) throw new Error(describePostgresError(error, "load RX jobs"));
    if (!data || data.length === 0) break;

    const unknown = [
      ...new Set(data.map((l) => l.order_id).filter((id) => !known.has(id))),
    ];
    if (unknown.length > 0) {
      const { data: kinds, error: kindError } = await supabase
        .from("orders")
        .select("id, combines_rx")
        .in("id", unknown);
      if (kindError) {
        throw new Error(describePostgresError(kindError, "load RX jobs"));
      }
      for (const o of kinds ?? []) {
        known.add(o.id);
        if (o.combines_rx) combined.add(o.id);
      }
    }

    matched.push(...data.filter((l) => !combined.has(l.order_id)));
    if (matched.length >= wantedLines || data.length < batch) break;
  }
  if (matched.length === 0) return [];

  // A search can hit one eye only; read the rest of those orders' RX lines so
  // each lens is shown with its partner.
  // Read in groups of orders, all at once: each request stays under the
  // server's row cap, so no partner lens is dropped from a long list.
  const matchedOrderIds = [...new Set(matched.map((l) => l.order_id))];
  const siblingReads = await Promise.all(
    chunk(matchedOrderIds, SIBLING_GROUP).map((ids) =>
      supabase
        .from("order_lines")
        .select("*")
        .not("rx_status", "is", null)
        .in("order_id", ids),
    ),
  );
  const siblings: OrderLine[] = [];
  for (const { data, error } of siblingReads) {
    if (error) throw new Error(describePostgresError(error, "load RX jobs"));
    siblings.push(...(data ?? []));
  }

  const matchedIds = new Set(matched.map((l) => l.id));
  const extra = siblings.filter((l) => !matchedIds.has(l.id));
  const lines = [...matched, ...extra];

  const supplierIds = [
    ...new Set(lines.map((l) => l.supplier_id).filter((id) => id !== null)),
  ];

  const [orders, suppliers] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_no, invoice_no, status, voided_at, bill_to_customer_id, rx_no, patient_name, order_by_name, lab_order_no, rx_stage, rx_sent_at, rx_back_at, rx_on_hold, billed_in, combines_rx",
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

  const orderById = new Map((orders.data ?? []).map((o) => [o.id, o]));

  // A billed RX order shows the combined invoice it went on. The shops and the
  // combined invoices both come from the orders read above, so they are read
  // together rather than one after the other.
  const billedIds = [
    ...new Set(
      (orders.data ?? []).map((o) => o.billed_in).filter((id) => id !== null),
    ),
  ];
  const [customerRead, billedRead] = await Promise.all([
    supabase
      .from("customers")
      .select("id, shop_name, area")
      .in("id", [
        ...new Set((orders.data ?? []).map((o) => o.bill_to_customer_id)),
      ]),
    billedIds.length > 0
      ? supabase.from("orders").select("id, invoice_no").in("id", billedIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const { data: customers, error: customerError } = customerRead;
  if (customerError) {
    throw new Error(describePostgresError(customerError, "load RX jobs"));
  }
  if (billedRead.error) {
    throw new Error(describePostgresError(billedRead.error, "load RX jobs"));
  }
  const billedNo = new Map<string, number | null>(
    (billedRead.data ?? []).map((b) => [b.id, b.invoice_no]),
  );
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
      rxOnHold: order?.rx_on_hold ?? false,
    };
  });

  return pairEyes(jobs, matchedIds).slice(0, limit);
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

/**
 * Put an RX order on hold at the lab, with the reason, or release the hold.
 * The database writes the reason into the order's notes, dated. The reason is
 * left out of the log: it can name a patient.
 */
export async function setRxHold(
  orderId: string,
  onHold: boolean,
  reason: string,
): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("set_rx_hold", {
    p_order_id: orderId,
    p_on_hold: onHold,
    p_reason: reason,
  });

  if (error) {
    throw new Error(describePostgresError(error, "update the RX hold"));
  }
  logger.info("RX hold changed", { orderId, onHold });
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
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(describePostgresError(error, "save the lab order number"));
  }
  if (!data) {
    throw new Error("That RX order could not be found.");
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
    .select("id, is_rx, issued_at, voided_at, billed_in, rx_stage, rx_on_hold")
    .eq("id", pricing.orderId)
    .maybeSingle();
  if (error) throw new Error(describePostgresError(error, "load the RX order"));
  if (!order?.is_rx) throw new Error("That is not an RX order.");
  if (order.issued_at || order.voided_at || order.billed_in) {
    throw new Error("This RX order is already invoiced.");
  }
  // Checked before any write: the stage change below would refuse it anyway,
  // after the prices had already been saved.
  if (order.rx_on_hold) {
    throw new Error(
      "This RX order is on hold. Release the hold before you enter its prices.",
    );
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

/**
 * Change an RX order's purchase price (the lab's, per lens) after it is
 * invoiced. Only our cost moves: the customer's invoice and ledger stay as
 * they are. The copy of each lens on the shop's combined invoice is updated
 * too — that is the line the profit figures read.
 */
export async function setRxCost(
  orderId: string,
  unitCost: number | null,
): Promise<void> {
  const { supabase } = await requireUser();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, is_rx, rx_no, billed_in")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(describePostgresError(error, "load the RX order"));
  if (!order?.is_rx) throw new Error("That is not an RX order.");

  const { error: ownError } = await supabase
    .from("order_lines")
    .update({ unit_cost: unitCost })
    .eq("order_id", orderId)
    .not("rx_status", "is", null);
  if (ownError) {
    throw new Error(
      describePostgresError(ownError, "change the purchase price"),
    );
  }

  if (order.billed_in && order.rx_no !== null) {
    // Its lenses on the combined invoice end in its RX number: "9493 · RX-0006".
    const { error: copyError } = await supabase
      .from("order_lines")
      .update({ unit_cost: unitCost })
      .eq("order_id", order.billed_in)
      .like("order_ref", `%RX-${String(order.rx_no).padStart(4, "0")}`);
    if (copyError) {
      throw new Error(
        describePostgresError(copyError, "change the purchase price"),
      );
    }
  }
  logger.info("RX cost changed", { orderId });
}

/**
 * Take an RX order off its shop's combined invoice. The database removes its
 * copies from the invoice, works the invoice total out again and moves the
 * shop's balances, keeping the invoice number (migration 0044). The order is
 * left uninvoiced for the caller to delete.
 */
export async function removeRxFromInvoice(orderId: string): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("remove_rx_from_invoice", {
    p_rx_order_id: orderId,
  });

  if (error) {
    throw new Error(
      describePostgresError(error, "remove the RX order from its invoice"),
    );
  }
  logger.info("RX order removed from invoice", { orderId });
}
