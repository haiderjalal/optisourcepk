import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type {
  LowStockLine,
  Product,
  StockBin,
  StockReason,
} from "@/types/database";
import { describePostgresError } from "./errors";

/**
 * Stock levels.
 *
 * Quantities are only ever changed through `adjust_stock` or `issue_invoice`,
 * both of which move the bin and write the movement in one transaction. This
 * layer never reads a quantity into JavaScript and writes an absolute value
 * back — that is how two concurrent edits lose one of them.
 */

export interface BinWithProduct extends StockBin {
  product: Pick<Product, "id" | "sku" | "name" | "unit" | "tracks_power">;
}

/** Every bin for one product, in dioptre order. */
export async function listBinsForProduct(
  productId: string,
): Promise<StockBin[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("stock_bins")
    .select("*")
    .eq("product_id", productId)
    .order("sph", { ascending: true, nullsFirst: true });

  if (error) throw new Error(describePostgresError(error, "load stock"));
  return data ?? [];
}

export async function listLowStock(): Promise<LowStockLine[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("low_stock")
    .select("*")
    .order("shortfall", { ascending: false });

  if (error) {
    throw new Error(describePostgresError(error, "load the low-stock list"));
  }
  return data ?? [];
}

export interface AdjustStockInput {
  productId: string;
  /** `null` for anything not stocked by power. */
  sph: number | null;
  /** Signed: positive receives, negative issues or writes off. */
  delta: number;
  reason: StockReason;
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
    p_delta: input.delta,
    p_reason: input.reason,
    p_note: input.note ?? null,
  });

  if (error) throw new Error(describePostgresError(error, "adjust the stock"));

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
