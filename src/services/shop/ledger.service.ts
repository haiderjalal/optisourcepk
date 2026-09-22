import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { PaymentPayload } from "@/lib/validations/shop/payment";
import type {
  CustomerBalance,
  CustomerStatementLine,
  LedgerEntry,
} from "@/types/database";
import { describePostgresError } from "./errors";

/**
 * The customer account: what each shop owes, and how it got there.
 *
 * The ledger is append-only and the balance is never stored — it is summed
 * from the entries, so the list screen and the statement cannot disagree.
 */

/** Record money received. One insert; the balance follows from it. */
export async function recordPayment(
  payload: PaymentPayload,
): Promise<LedgerEntry> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      customer_id: payload.customerId,
      entry_date: payload.entryDate,
      entry_type: "payment",
      // Negative: a payment reduces what the shop owes. The database enforces
      // the sign, so a positive amount here would be rejected outright.
      amount: -Math.abs(payload.amount),
      payment_method: payload.method,
      reference: payload.reference?.trim() || null,
      memo: payload.memo?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(describePostgresError(error, "record the payment"));
  }

  logger.info("Payment recorded", {
    customerId: payload.customerId,
    method: payload.method,
  });

  return data;
}

/** Dated statement with a running balance, oldest first. */
export async function getStatement(
  customerId: string,
): Promise<CustomerStatementLine[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("customer_statement")
    .select("*")
    .eq("customer_id", customerId)
    .order("entry_date")
    .order("running_balance");

  if (error) {
    throw new Error(describePostgresError(error, "load the statement"));
  }
  return data ?? [];
}

export async function getBalance(
  customerId: string,
): Promise<CustomerBalance | null> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("customer_balances")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(describePostgresError(error, "load the balance"));
  return data;
}

/** Every shop that owes money, most owing first. */
export async function listOutstanding(): Promise<CustomerBalance[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("customer_balances")
    .select("*")
    .gt("balance", 0)
    .order("balance", { ascending: false });

  if (error) {
    throw new Error(describePostgresError(error, "load outstanding balances"));
  }
  return data ?? [];
}

export interface LedgerTotals {
  receivable: number;
  customersOwing: number;
}

/** Headline figures for the dashboard. */
export async function getLedgerTotals(): Promise<LedgerTotals> {
  const owing = await listOutstanding();
  return {
    receivable: owing.reduce((sum, row) => sum + row.balance, 0),
    customersOwing: owing.length,
  };
}

export async function listRecentPayments(limit = 10): Promise<LedgerEntry[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*")
    .eq("entry_type", "payment")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(describePostgresError(error, "load payments"));
  return data ?? [];
}
