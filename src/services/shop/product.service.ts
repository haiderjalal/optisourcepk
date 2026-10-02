import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { ProductPayload } from "@/lib/validations/shop/product";
import type { Product, ProductCategory } from "@/types/database";
import { describePostgresError } from "./errors";
import { selectAllPages } from "./paging";

/** A product with its total quantity across every power bin. */
export interface ProductWithStock extends Product {
  totalQty: number;
  binCount: number;
}

function toRow(payload: ProductPayload) {
  return {
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
    is_rx: payload.isRx,
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
    // Any whole degree is valid, so axis has no step.
    axis_step: null,
    eyes: payload.eyes ? payload.eyes : null,
    lens_sign: payload.lensSign ? payload.lensSign : null,
    alert_qty: payload.alertQty,
  };
}

export async function listProducts(
  search?: string,
  limit?: number,
): Promise<ProductWithStock[]> {
  const { supabase } = await requireUser();

  // RX lenses are kept apart — they live on the RX screen, not in Products.
  let query = supabase
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .eq("is_rx", false)
    .order("category")
    .order("name");

  const term = search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,()]/g, " ");
    query = query.ilike("name", `%${escaped}%`);
  }

  if (limit !== undefined) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(describePostgresError(error, "load products"));

  const products = data ?? [];
  if (products.length === 0) return [];

  // Only read bins for the products visible on this page.
  let bins: { product_id: string; qty_on_hand: number }[];
  try {
    bins = await selectAllPages((from, to) =>
      supabase
        .from("stock_bins")
        .select("id, product_id, qty_on_hand")
        .in(
          "product_id",
          products.map((product) => product.id),
        )
        .order("id")
        .range(from, to),
    );
  } catch (error) {
    throw new Error(describePostgresError(error, "load stock levels"));
  }

  const totals = new Map<string, { qty: number; bins: number }>();
  for (const bin of bins) {
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

/**
 * Products that can appear on a stock order or purchase, for the pickers.
 * RX lenses are left out: they are typed on the RX job card instead.
 */
export async function listSellableProducts(): Promise<Product[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .eq("is_rx", false)
    .order("name");

  if (error) throw new Error(describePostgresError(error, "load products"));
  return data ?? [];
}

/** The RX lens descriptions typed on earlier job cards, for suggestions. */
export async function listRxProducts(): Promise<Product[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .eq("is_rx", true)
    .order("name");

  if (error) throw new Error(describePostgresError(error, "load RX lenses"));
  return data ?? [];
}

/** A typed product name, compared the way a person would: case and spaces aside. */
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The product id for each typed RX product name, adding any not seen before.
 *
 * RX lenses are priced per job and never stocked, so a new name becomes a
 * RX lens with no price and no stock — just a name to pick next time. Only
 * RX lenses are matched: the RX list is kept apart from Products, so a stock
 * lens with the same name is never borrowed.
 */
export async function resolveRxProducts(
  names: string[],
): Promise<Map<string, string>> {
  const { supabase } = await requireUser();

  const wanted = new Map<string, string>();
  for (const name of names) {
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean) wanted.set(nameKey(clean), clean);
  }
  const ids = new Map<string, string>();
  if (wanted.size === 0) return ids;

  // ponytail: reads every product name to match case-insensitively; fine for a
  // shop catalogue, move to a unique index on lower(name) if it grows large.
  const { data: existing, error } = await supabase
    .from("products")
    .select("id, name")
    .is("deleted_at", null)
    .eq("is_rx", true)
    .order("created_at");
  if (error) throw new Error(describePostgresError(error, "read the products"));

  for (const product of existing ?? []) {
    const key = nameKey(product.name);
    if (wanted.has(key) && !ids.has(key)) ids.set(key, product.id);
  }

  const missing = [...wanted].filter(([key]) => !ids.has(key));
  if (missing.length > 0) {
    const { data: created, error: createError } = await supabase
      .from("products")
      .insert(
        missing.map(([, name]) => ({
          name,
          category: "lenses" as ProductCategory,
          is_rx: true,
          tracks_stock: false,
        })),
      )
      .select("id, name");
    if (createError) {
      throw new Error(describePostgresError(createError, "add the RX product"));
    }
    for (const product of created ?? [])
      ids.set(nameKey(product.name), product.id);
    logger.info("RX products added", { count: missing.length });
  }

  return ids;
}

/** Look up the id `resolveRxProducts` gave a typed name. */
export function rxProductId(
  ids: Map<string, string>,
  name: string,
): string | undefined {
  return ids.get(nameKey(name));
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
