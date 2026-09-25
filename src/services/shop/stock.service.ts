import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type {
  LowStockLine,
  Product,
  StockBin,
  StockReason,
} from "@/types/database";
import { toProductStock, type ProductStock } from "@/features/shop/stock/sheet";
import { describePostgresError } from "./errors";
import { selectAllPages } from "./paging";

export type {
  ProductStock,
  StockCell,
  StockSheet,
} from "@/features/shop/stock/sheet";

/**
 * Stock levels.
 *
 * Quantities are only ever changed through `adjust_stock` or `issue_invoice`,
 * both of which move the bin and write the movement in one transaction. This
 * layer never reads a quantity into JavaScript and writes an absolute value
 * back — that is how two concurrent edits lose one of them.
 */

export interface BinWithProduct extends StockBin {
  product: Pick<Product, "id" | "name" | "unit" | "tracks_power">;
}

/** Every bin for one product, in dioptre order. */
export async function listBinsForProduct(
  productId: string,
): Promise<StockBin[]> {
  const { supabase } = await requireUser();

  try {
    return await selectAllPages<StockBin>((from, to) =>
      supabase
        .from("stock_bins")
        .select("*")
        .eq("product_id", productId)
        .order("sph", { ascending: true, nullsFirst: true })
        .order("id")
        .range(from, to),
    );
  } catch (error) {
    throw new Error(describePostgresError(error, "load stock"));
  }
}

/**
 * The worst `limit` low-stock lines, plus how many there are in all.
 *
 * Counted by the database rather than by length: the list can run to
 * thousands of powers, and the API would cut a full read off at 1,000.
 */
export async function listLowStock(
  limit = 12,
): Promise<{ lines: LowStockLine[]; total: number }> {
  const { supabase } = await requireUser();

  const { data, error, count } = await supabase
    .from("low_stock")
    .select("*", { count: "exact" })
    .order("shortfall", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(describePostgresError(error, "load the low-stock list"));
  }
  return { lines: data ?? [], total: count ?? data?.length ?? 0 };
}

export interface AdjustStockInput {
  productId: string;
  /** Each is `null` when the product is not split by that attribute. */
  sph: number | null;
  cyl: number | null;
  addPower: number | null;
  eye: "R" | "L" | null;
  /** Signed: positive receives, negative issues or writes off. */
  delta: number;
  reason: StockReason;
  /** When given, the bin's alert level is set after the movement. */
  alertQty?: number | null;
  note?: string | null;
}

/**
 * Receive, return or correct stock.
 *
 * Creates the bin on first receipt. The database refuses to take a bin below
 * zero, so an over-issue fails rather than silently going negative.
 */
export async function adjustStock(input: AdjustStockInput): Promise<number> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: input.productId,
    p_sph: input.sph,
    p_cyl: input.cyl,
    p_add: input.addPower,
    p_eye: input.eye,
    p_delta: input.delta,
    p_reason: input.reason,
    p_note: input.note ?? null,
  });

  if (error) throw new Error(describePostgresError(error, "adjust the stock"));

  // Setting the alert level is a separate, non-critical step: the stock has
  // already moved, and failing here must not suggest otherwise.
  if (input.alertQty !== null && input.alertQty !== undefined) {
    const alert = await supabase.rpc("set_bin_alert", {
      p_product_id: input.productId,
      p_sph: input.sph,
      p_cyl: input.cyl,
      p_add: input.addPower,
      p_eye: input.eye,
      p_level: input.alertQty,
    });
    if (alert.error) {
      logger.warn("Alert quantity not set", { code: alert.error.code });
    }
  }

  logger.info("Stock adjusted", {
    productId: input.productId,
    sph: input.sph,
    delta: input.delta,
    reason: input.reason,
  });

  return data;
}

/**
 * Set a bin's reorder level.
 *
 * A plain column update, not a movement: it changes when we want to be warned,
 * not how much is there.
 */
export async function setReorderLevel(
  binId: string,
  level: number,
): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("stock_bins")
    .update({ reorder_level: level })
    .eq("id", binId);

  if (error) {
    throw new Error(describePostgresError(error, "set the reorder level"));
  }
}

export interface StockMovementLine {
  id: string;
  delta: number;
  reason: StockReason;
  note: string | null;
  created_at: string;
  sph: number | null;
}

/**
 * Recent movements for one product, newest first — the audit trail.
 *
 * Two queries rather than an embedded join: the bins for a product are a short
 * list, and resolving the power in memory keeps this independent of PostgREST
 * relationship metadata.
 */
export async function listMovements(
  productId: string,
  limit = 50,
): Promise<StockMovementLine[]> {
  const { supabase } = await requireUser();

  const bins = await listBinsForProduct(productId);
  if (bins.length === 0) return [];

  const sphByBin = new Map(bins.map((bin) => [bin.id, bin.sph]));

  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, bin_id, delta, reason, note, created_at")
    .in(
      "bin_id",
      bins.map((bin) => bin.id),
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(describePostgresError(error, "load the stock history"));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    delta: row.delta,
    reason: row.reason,
    note: row.note,
    created_at: row.created_at,
    sph: sphByBin.get(row.bin_id) ?? null,
  }));
}

/**
 * Every product with its stock, for the stock screen.
 *
 * Products with no stock yet are included on purpose — "nothing received"
 * is the state the operator most needs to see. A product with a power range
 * shows every power in it, 0 where nothing is held, so a gap on the shelf is
 * as visible as a count.
 */
export async function listAllStock(): Promise<ProductStock[]> {
  const { supabase } = await requireUser();

  const [products, bins] = await Promise.all([
    supabase.from("products").select("*").is("deleted_at", null).order("name"),
    selectAllPages<StockBin>((from, to) =>
      supabase.from("stock_bins").select("*").order("id").range(from, to),
    ).catch((error: unknown) => {
      throw new Error(describePostgresError(error, "load stock"));
    }),
  ]);

  if (products.error) {
    throw new Error(describePostgresError(products.error, "load products"));
  }

  const byProduct = new Map<string, StockBin[]>();
  for (const bin of bins) {
    const list = byProduct.get(bin.product_id) ?? [];
    list.push(bin);
    byProduct.set(bin.product_id, list);
  }

  return (products.data ?? [])
    .filter((product) => product.tracks_stock)
    .map((product) => toProductStock(product, byProduct.get(product.id) ?? []));
}

/** One product's stock, for its printable stock sheet. */
export async function getProductStock(
  productId: string,
): Promise<ProductStock | null> {
  const { supabase } = await requireUser();

  const [product, bins] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .is("deleted_at", null)
      .maybeSingle(),
    selectAllPages<StockBin>((from, to) =>
      supabase
        .from("stock_bins")
        .select("*")
        .eq("product_id", productId)
        .order("id")
        .range(from, to),
    ).catch((error: unknown) => {
      throw new Error(describePostgresError(error, "load stock"));
    }),
  ]);

  if (product.error) {
    throw new Error(describePostgresError(product.error, "load the product"));
  }
  if (!product.data?.tracks_stock) return null;

  return toProductStock(product.data, bins);
}

export interface LineAvailability {
  productId: string;
  productName: string;
  unit: string;
  sph: number | null;
  cyl: number | null;
  add_power: number | null;
  eye: string | null;
  needed: number;
  onHand: number;
  /** No bin matched at all — nothing has been received for this position. */
  missing: boolean;
  short: boolean;
}

/**
 * A zero cylinder or addition means none, so it is the same bin as blank.
 * SPH is left alone: 0.00 there is a plano lens, a real power.
 */
function normalise(value: number | null): number | null {
  return value === 0 ? null : value;
}

/**
 * Can this order actually be invoiced?
 *
 * Deliberately mirrors `issue_invoice` step for step — group demand by the bin
 * a line draws on, try the exact shelf position, then fall back to the general
 * bin for that power. When this drifts from the function, the page cheerfully
 * reports stock the transaction then refuses, which is worse than no check at
 * all. The database stays the authority; this is a preview of its answer.
 */
export async function checkOrderStock(
  orderId: string,
): Promise<LineAvailability[]> {
  const { supabase } = await requireUser();

  const { data: lines, error } = await supabase
    .from("order_lines")
    .select(
      "product_id, sph, cyl, add_power, eye, quantity, product_name, unit",
    )
    .eq("order_id", orderId);

  if (error) throw new Error(describePostgresError(error, "check stock"));
  if (!lines || lines.length === 0) return [];

  const productIds = [...new Set(lines.map((l) => l.product_id))];

  const [products, bins] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, unit, tracks_stock")
      .in("id", productIds),
    selectAllPages((from, to) =>
      supabase
        .from("stock_bins")
        .select("id, product_id, sph, cyl, add_power, eye, qty_on_hand")
        .in("product_id", productIds)
        .order("id")
        .range(from, to),
    ).catch((error: unknown) => {
      throw new Error(describePostgresError(error, "check stock"));
    }),
  ]);

  if (products.error) {
    throw new Error(describePostgresError(products.error, "check stock"));
  }

  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));

  const part = (v: number | string | null) => (v === null ? "~" : String(v));
  const binKey = (
    id: string,
    sph: number | null,
    cyl: number | null,
    add: number | null,
    eye: string | null,
  ) => [id, part(sph), part(cyl), part(add), part(eye)].join("|");

  const exact = new Map<string, number>();
  const general = new Map<string, number>();

  for (const b of bins) {
    const cyl = normalise(b.cyl);
    const add = normalise(b.add_power);
    exact.set(binKey(b.product_id, b.sph, cyl, add, b.eye), b.qty_on_hand);
    if (cyl === null && add === null && b.eye === null) {
      general.set(`${b.product_id}|${part(b.sph)}`, b.qty_on_hand);
    }
  }

  // Several lines can draw on one bin — two eyes at the same power, say — so
  // demand is summed per bin before it is compared, as the database does.
  interface Demand {
    productId: string;
    sph: number | null;
    cyl: number | null;
    add: number | null;
    eye: string | null;
    qty: number;
  }
  const demand = new Map<string, Demand>();

  for (const line of lines) {
    const product = productById.get(line.product_id);
    if (!product?.tracks_stock) continue;

    const cyl = normalise(line.cyl);
    const add = normalise(line.add_power);
    const k = binKey(line.product_id, line.sph, cyl, add, line.eye);
    const existing = demand.get(k);

    if (existing) existing.qty += line.quantity;
    else {
      demand.set(k, {
        productId: line.product_id,
        sph: line.sph,
        cyl,
        add,
        eye: line.eye,
        qty: line.quantity,
      });
    }
  }

  const out: LineAvailability[] = [];

  for (const [k, d] of demand) {
    const product = productById.get(d.productId);
    const have = exact.get(k) ?? general.get(`${d.productId}|${part(d.sph)}`);

    out.push({
      productId: d.productId,
      productName: product?.name ?? "Unknown product",
      unit: product?.unit ?? "pcs",
      sph: d.sph,
      cyl: d.cyl,
      add_power: d.add,
      eye: d.eye,
      needed: d.qty,
      onHand: have ?? 0,
      missing: have === undefined,
      short: have !== undefined && have < d.qty,
    });
  }

  return out.sort((a, b) => a.productName.localeCompare(b.productName));
}

/**
 * Create every bin in a product's declared range at once.
 *
 * One database call, one transaction: the whole grid appears or none of it
 * does. Existing bins are topped up rather than reset, so running it twice
 * does not quietly discard a count.
 */
export async function receiveRange(
  productId: string,
  qty: number,
  alertQty: number | null,
): Promise<number> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("receive_range", {
    p_product_id: productId,
    p_qty: qty,
    p_alert: alertQty,
  });

  if (error) throw new Error(describePostgresError(error, "fill the range"));

  logger.info("Range filled", { productId, qty, bins: data });
  return data;
}

export interface PowerEntry {
  sph: number | null;
  /** Omitted when the whole batch shares one cylinder. */
  cyl?: number | null;
  add?: number | null;
  qty: number;
}

/**
 * Take in a different quantity against each power, in one transaction.
 *
 * What a real delivery looks like: twenty of one power, six of the next,
 * none of the one after. Entries with no quantity are dropped before the
 * call, so an untouched row costs nothing.
 */
export async function receivePowers(input: {
  productId: string;
  entries: PowerEntry[];
  cyl: number | null;
  addPower: number | null;
  eye: string | null;
  alertQty: number | null;
  reason: StockReason;
  note: string | null;
}): Promise<number> {
  const { supabase } = await requireUser();

  const entries = input.entries.filter((e) => e.qty !== 0);
  if (entries.length === 0) return 0;

  const { data, error } = await supabase.rpc("receive_powers", {
    p_product_id: input.productId,
    p_entries: entries,
    p_cyl: input.cyl,
    p_add: input.addPower,
    p_eye: input.eye,
    p_alert: input.alertQty,
    p_reason: input.reason,
    p_note: input.note,
  });

  if (error) throw new Error(describePostgresError(error, "receive the stock"));

  logger.info("Powers received", {
    productId: input.productId,
    bins: data,
  });
  return data;
}
