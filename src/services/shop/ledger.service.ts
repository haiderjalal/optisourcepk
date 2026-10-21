import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { PaymentPayload } from "@/lib/validations/shop/payment";
import type {
  BusinessTotals,
  CustomerBalance,
  CustomerStatementLine,
  LedgerEntry,
} from "@/types/database";
import { describePostgresError } from "./errors";
import { selectAllPages } from "./paging";

/**
 * The customer account: what each shop owes, and how it got there.
 *
 * The ledger is append-only and the balance is never stored — it is summed
 * from the entries, so the list screen and the statement cannot disagree.
 */

/** Record a payment or payment-discount adjustment. */
export async function recordPayment(
  payload: PaymentPayload,
): Promise<LedgerEntry> {
  const { supabase } = await requireUser();

  const isPayment = payload.entryKind === "payment";
  const removesDiscount = payload.entryKind === "remove_discount";
  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      customer_id: payload.customerId,
      entry_date: payload.entryDate,
      entry_type: isPayment ? "payment" : "adjustment",
      // Payments and added discounts reduce what is owed; removing a previous
      // discount adds it back. The form always supplies a positive magnitude.
      amount: removesDiscount
        ? Math.abs(payload.amount)
        : -Math.abs(payload.amount),
      payment_method: isPayment ? payload.method : null,
      reference: payload.reference?.trim() || null,
      memo:
        payload.memo?.trim() ||
        (payload.entryKind === "discount"
          ? "Payment discount"
          : removesDiscount
            ? "Payment discount removed"
            : null),
    })
    .select()
    .single();

  if (error) {
    throw new Error(describePostgresError(error, "record the payment"));
  }

  logger.info("Payment recorded", {
    customerId: payload.customerId,
    kind: payload.entryKind,
  });

  return data;
}

/**
 * Dated statement with a running balance, oldest first. Ordered by the sequence
 * the balance was summed in, so entries on the same day read in the order they
 * happened and each balance follows the row above it.
 */
export async function getStatement(
  customerId: string,
): Promise<CustomerStatementLine[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("customer_statement")
    .select("*")
    .eq("customer_id", customerId)
    .order("statement_seq");

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

/**
 * Every shop that owes money, most owing first. Read a page at a time: the
 * dashboard totals come from this list, and one read would stop at the row
 * cap and understate what is owed.
 */
export async function listOutstanding(): Promise<CustomerBalance[]> {
  const { supabase } = await requireUser();

  return selectAllPages<CustomerBalance>((from, to) =>
    supabase
      .from("customer_balances")
      .select("*")
      .gt("balance", 0)
      .order("balance", { ascending: false })
      .order("customer_id")
      .range(from, to),
  ).catch((error: unknown) => {
    throw new Error(describePostgresError(error, "load outstanding balances"));
  });
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
    .in("entry_type", ["payment", "adjustment"])
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(describePostgresError(error, "load payments"));
  return data ?? [];
}

/**
 * Move a payment or adjustment entered by hand into Recently deleted. The
 * database takes it out of the later invoices' stored balances (migration 0045),
 * and it can be restored for 7 days.
 */
export async function removeLedgerEntry(entryId: string): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("trash_ledger_entry", {
    p_entry_id: entryId,
  });

  if (error) {
    throw new Error(describePostgresError(error, "remove the entry"));
  }
  logger.info("Ledger entry moved to Recently deleted", { entryId });
}

/** One ledger entry, for the page that corrects it. */
export async function getLedgerEntry(id: string): Promise<LedgerEntry | null> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(describePostgresError(error, "load the entry"));
  return data;
}

export interface LedgerEntryCorrection {
  entryId: string;
  /** The magnitude: its sign is kept by the database. */
  amount: number;
  /** Required for a payment; ignored for an adjustment. */
  method: string | null;
  reference: string | null;
  memo: string | null;
}

/**
 * Correct a payment or adjustment entered by hand. Invoices issued after it
 * move by the change in its amount, as they do when it is removed (migration
 * 0047).
 */
export async function updateLedgerEntry(
  input: LedgerEntryCorrection,
): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("update_ledger_entry", {
    p_entry_id: input.entryId,
    p_amount: input.amount,
    p_method: input.method,
    p_reference: input.reference,
    p_memo: input.memo,
  });

  if (error) {
    throw new Error(describePostgresError(error, "save the entry"));
  }
  logger.info("Ledger entry corrected", { entryId: input.entryId });
}

/** Lifetime RX and stock sales/purchases, kept as four separate figures. */
export async function getBusinessTotals(): Promise<BusinessTotals> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("business_totals")
    .select("*")
    .single();

  if (error)
    throw new Error(describePostgresError(error, "load ledger totals"));
  return data;
}
