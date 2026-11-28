import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { SupplierPaymentPayload } from "@/lib/validations/shop/supplier-payment";
import type { SupplierBalance, SupplierPayment } from "@/types/database";
import { describePostgresError } from "./errors";

/** Money sent to a supplier's account, and what is still owed to them. */

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Records a payment; the database refuses more than the supplier is owed. */
export async function recordSupplierPayment(
  supplierId: string,
  payload: SupplierPaymentPayload,
): Promise<string> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("record_supplier_payment", {
    p_supplier_id: supplierId,
    p_amount: payload.amount,
    p_payment_date: optional(payload.paymentDate),
    p_method: payload.method,
    p_reference: optional(payload.reference),
    p_memo: optional(payload.memo),
  });

  if (error) {
    throw new Error(describePostgresError(error, "record the payment"));
  }

  logger.info("Supplier payment recorded", { paymentId: data, supplierId });
  return data;
}

/** What the supplier's bills add up to: bought, paid, and still owed. */
export async function getSupplierBalance(
  supplierId: string,
): Promise<SupplierBalance | null> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("supplier_balances")
    .select("*")
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (error) {
    throw new Error(describePostgresError(error, "load the balance"));
  }
  return data;
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
