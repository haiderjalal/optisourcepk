import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { DailyStockPayload } from "@/lib/validations/shop/stock";
import type { DailyStockEntry } from "@/types/database";
import { describePostgresError } from "./errors";

/** Recent daily-register rows, newest business date first. */
export async function listDailyStockEntries(
  limit = 180,
): Promise<DailyStockEntry[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("daily_stock_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(describePostgresError(error, "load daily stock history"));
  }
  return data ?? [];
}

/** Create or correct one item's row for one day without touching stock bins. */
export async function saveDailyStockEntry(
  payload: DailyStockPayload,
): Promise<DailyStockEntry> {
  const { supabase } = await requireUser();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, unit")
    .eq("id", payload.productId)
    .is("deleted_at", null)
    .maybeSingle();

  if (productError) {
    throw new Error(describePostgresError(productError, "load the item"));
  }
  if (!product) throw new Error("That item is unavailable.");

  const { data, error } = await supabase
    .from("daily_stock_entries")
    .upsert(
      {
        product_id: product.id,
        product_name: product.name,
        unit: product.unit,
        entry_date: payload.entryDate,
        opening_qty: payload.openingQty,
        received_qty: payload.receivedQty,
        outgoing_qty: payload.outgoingQty,
        note: payload.note || null,
      },
      { onConflict: "product_id,entry_date" },
    )
    .select()
    .single();

  if (error) {
    throw new Error(describePostgresError(error, "save daily stock"));
  }

  logger.info("Daily stock saved", {
    productId: payload.productId,
    entryDate: payload.entryDate,
  });
  return data;
}
