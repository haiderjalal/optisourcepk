import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { ProductPayload } from "@/lib/validations/shop/product";
import type { Product, ProductCategory } from "@/types/database";
import { describePostgresError } from "./errors";

/** A product with its total quantity across every power bin. */
export interface ProductWithStock extends Product {
  totalQty: number;
  binCount: number;
}

function toRow(payload: ProductPayload) {
  return {
    sku: payload.sku.toUpperCase(),
    name: payload.name,
    category: payload.category as ProductCategory,
    unit: payload.unit,
    list_price: payload.listPrice,
    purchase_price: payload.purchasePrice,
    tracks_power: payload.tracksPower,
    tracks_cyl: payload.tracksCyl,
    tracks_add: payload.tracksAdd,
    tracks_eye: payload.tracksEye,
    tracks_stock: payload.tracksStock,
    sph_min: payload.sphMin,
    sph_max: payload.sphMax,
    sph_step: payload.sphStep,
    cyl_min: payload.cylMin,
    cyl_max: payload.cylMax,
    cyl_step: payload.cylStep,
    add_min: payload.addMin,
    add_max: payload.addMax,
    add_step: payload.addStep,
    axis_min: payload.axisMin,
    axis_max: payload.axisMax,
    axis_step: payload.axisStep,
    eyes: payload.eyes ? payload.eyes : null,
  };
}

export async function listProducts(
  search?: string,
): Promise<ProductWithStock[]> {
  const { supabase } = await requireUser();

  let query = supabase
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .order("category")
    .order("name");

  const term = search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,()]/g, " ");
    query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(describePostgresError(error, "load products"));

  const products = data ?? [];
  if (products.length === 0) return [];

  // One query for every bin, then folded in memory — not one query per product.
  const { data: bins, error: binError } = await supabase
    .from("stock_bins")
    .select("product_id, qty_on_hand");

  if (binError) {
    throw new Error(describePostgresError(binError, "load stock levels"));
  }

  const totals = new Map<string, { qty: number; bins: number }>();
  for (const bin of bins ?? []) {
    const current = totals.get(bin.product_id) ?? { qty: 0, bins: 0 };
    current.qty += bin.qty_on_hand;
    current.bins += 1;
    totals.set(bin.product_id, current);
  }

  return products.map((product) => ({
    ...product,
    totalQty: totals.get(product.id)?.qty ?? 0,
    binCount: totals.get(product.id)?.bins ?? 0,
  }));
}

export async function getProduct(id: string): Promise<Product | null> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(describePostgresError(error, "load product"));
  return data;
}

/** Products that can appear on an invoice line, for the builder's picker. */
export async function listSellableProducts(): Promise<Product[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .order("name");

  if (error) throw new Error(describePostgresError(error, "load products"));
  return data ?? [];
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("products")
    .insert(toRow(payload))
    .select()
    .single();

  if (error) throw new Error(describePostgresError(error, "save the product"));

  logger.info("Product created", { productId: data.id });
  return data;
}

export async function updateProduct(
  id: string,
  payload: ProductPayload,
): Promise<Product> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("products")
    .update(toRow(payload))
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) throw new Error(describePostgresError(error, "save the product"));

  logger.info("Product updated", { productId: id });
  return data;
}

/**
 * Soft delete.
 *
 * Issued invoices reference the product row, so it is hidden rather than
 * removed. Its stock bins stay put: if it is ever un-archived the counts are
 * still right.
 */
export async function archiveProduct(id: string): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(describePostgresError(error, "archive the product"));
  }

  logger.info("Product archived", { productId: id });
}
