import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { SupplierPaymentPayload } from "@/lib/validations/shop/supplier-payment";
import type { PurchaseInvoiceBalance, SupplierPayment } from "@/types/database";
import { describePostgresError } from "./errors";

/** Money sent to suppliers, each payment against one purchase invoice. */

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Records a payment; the database refuses more than the invoice still owes. */
export async function recordSupplierPayment(
  payload: SupplierPaymentPayload,
): Promise<string> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("record_supplier_payment", {
    p_purchase_invoice_id: payload.purchaseInvoiceId,
    p_amount: payload.amount,
    p_payment_date: optional(payload.paymentDate),
    p_method: payload.method,
    p_reference: optional(payload.reference),
    p_memo: optional(payload.memo),
  });

  if (error) {
    throw new Error(describePostgresError(error, "record the payment"));
  }

  logger.info("Supplier payment recorded", {
    paymentId: data,
    purchaseInvoiceId: payload.purchaseInvoiceId,
  });
  return data;
}

/** Every purchase invoice of a supplier, with what was paid and what is owed. */
export async function listInvoiceBalances(
  supplierId: string,
): Promise<PurchaseInvoiceBalance[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("purchase_invoice_balances")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("invoice_date", { ascending: false });

  if (error) {
    throw new Error(describePostgresError(error, "load the invoices"));
  }
  return data ?? [];
}

/** The payments sent to a supplier, newest first. */
export async function listSupplierPayments(
  supplierId: string,
): Promise<SupplierPayment[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("supplier_payments")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(describePostgresError(error, "load the payments"));
  }
  return data ?? [];
}
