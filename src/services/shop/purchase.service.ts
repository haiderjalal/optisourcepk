import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type {
  PurchaseInvoiceLine,
  PurchaseInvoiceSummary,
  PurchaseLineInput,
} from "@/types/database";
import { describePostgresError } from "./errors";

/**
 * Purchase invoices — what was bought, from whom, at what cost.
 *
 * Recording one moves the stock in the same transaction (`record_purchase`),
 * so an invoice on file and the stock it brought in can never disagree.
 */

export async function listPurchases(filter?: {
  supplierId?: string;
  limit?: number;
}): Promise<PurchaseInvoiceSummary[]> {
  const { supabase } = await requireUser();

  let query = supabase
    .from("purchase_invoice_totals")
    .select("*")
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filter?.limit ?? 100);

  if (filter?.supplierId) query = query.eq("supplier_id", filter.supplierId);

  const { data, error } = await query;
  if (error) throw new Error(describePostgresError(error, "load purchases"));
  return data ?? [];
}

export interface PurchaseWithLines extends PurchaseInvoiceSummary {
  lines: PurchaseInvoiceLine[];
}

export async function getPurchase(
  id: string,
): Promise<PurchaseWithLines | null> {
  const { supabase } = await requireUser();

  const [header, lines] = await Promise.all([
    supabase
      .from("purchase_invoice_totals")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("purchase_invoice_lines")
      .select("*")
      .eq("purchase_invoice_id", id)
      .order("created_at")
      .order("product_name"),
  ]);

  if (header.error) {
    throw new Error(describePostgresError(header.error, "load the purchase"));
  }
  if (lines.error) {
    throw new Error(describePostgresError(lines.error, "load the purchase"));
  }
  if (!header.data) return null;

  return { ...header.data, lines: lines.data ?? [] };
}

/**
 * Save a supplier invoice and take its stock in, in one transaction.
 *
 * The same supplier and invoice number again appends to the invoice already
 * on file — one paper invoice is often entered a product at a time.
 */
export async function recordPurchase(input: {
  supplierId: string;
  invoiceNo: string;
  invoiceDate: string | null;
  lines: PurchaseLineInput[];
  notes: string | null;
}): Promise<string> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("record_purchase", {
    p_supplier_id: input.supplierId,
    p_invoice_no: input.invoiceNo,
    p_invoice_date: input.invoiceDate,
    p_lines: input.lines,
    p_notes: input.notes,
  });

  if (error) throw new Error(describePostgresError(error, "save the purchase"));

  logger.info("Purchase recorded", {
    purchaseInvoiceId: data,
    lines: input.lines.length,
  });
  return data;
}
