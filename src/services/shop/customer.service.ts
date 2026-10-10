import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { CustomerPayload } from "@/lib/validations/shop/customer";
import type { Customer, CustomerBalance } from "@/types/database";
import { describePostgresError } from "./errors";

/**
 * Customer records and their account balances.
 *
 * Every function re-checks the session through `requireUser()` rather than
 * trusting that a caller already did.
 */

export interface CustomerWithBalance extends Customer {
  balance: number;
}

/** Empty string from a form field means "not given", not "set to empty". */
function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toRow(payload: CustomerPayload) {
  return {
    customer_name: payload.customerName,
    shop_name: payload.shopName,
    area: payload.area,
    address: payload.address,
    phone: payload.phone,
    phone_alt: optional(payload.phoneAlt),
    ntn: optional(payload.ntn),
    strn: optional(payload.strn),
    default_discount_pct: payload.defaultDiscountPct,
    opening_balance: payload.openingBalance,
    opening_balance_date: payload.openingBalanceDate,
    notes: optional(payload.notes),
  };
}

export interface CustomerSearchOptions {
  /**
   * Match shop, owner and phone only. The shop finder uses this: a word like
   * "Pakistan" sits in every shop's area and would match them all.
   */
  namesOnly?: boolean;
}

export async function listCustomers(
  search?: string,
  limit?: number,
  { namesOnly = false }: CustomerSearchOptions = {},
): Promise<CustomerWithBalance[]> {
  const { supabase } = await requireUser();

  let query = supabase
    .from("customers")
    .select("*")
    .is("deleted_at", null)
    .order("shop_name");

  // Filtering happens in the database, not over a downloaded list.
  const term = search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,()]/g, " ");
    const columns = namesOnly
      ? ["shop_name", "customer_name", "phone"]
      : ["shop_name", "customer_name", "area", "phone"];
    query = query.or(
      columns.map((column) => `${column}.ilike.%${escaped}%`).join(","),
    );
  }

  if (limit !== undefined) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(describePostgresError(error, "load customers"));

  const customers = data ?? [];
  const balances = await loadBalances(
    supabase,
    customers.map((customer) => customer.id),
  );

  return customers.map((customer) => ({
    ...customer,
    balance: balances.get(customer.id) ?? customer.opening_balance,
  }));
}

/** One round trip for every balance, rather than one query per customer. */
async function loadBalances(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  customerIds: string[],
): Promise<Map<string, number>> {
  if (customerIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("customer_balances")
    .select("customer_id, balance")
    .in("customer_id", customerIds);

  if (error) throw new Error(describePostgresError(error, "load balances"));

  return new Map(
    (data ?? []).map(
      (row: Pick<CustomerBalance, "customer_id" | "balance">) => [
        row.customer_id,
        row.balance,
      ],
    ),
  );
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(describePostgresError(error, "load customer"));
  return data;
}

/** Names for a small set of order rows, without loading the customer ledger. */
export async function getCustomerShopNames(
  ids: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("customers")
    .select("id, shop_name")
    .in("id", uniqueIds);

  if (error) throw new Error(describePostgresError(error, "load customers"));
  return new Map(
    (data ?? []).map((customer) => [customer.id, customer.shop_name]),
  );
}

export async function createCustomer(
  payload: CustomerPayload,
): Promise<Customer> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("customers")
    .insert(toRow(payload))
    .select()
    .single();

  if (error) throw new Error(describePostgresError(error, "save the customer"));

  logger.info("Customer created", { customerId: data.id });
  return data;
}

export async function updateCustomer(
  id: string,
  payload: CustomerPayload,
): Promise<Customer> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("customers")
    .update(toRow(payload))
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) throw new Error(describePostgresError(error, "save the customer"));

  logger.info("Customer updated", { customerId: id });
  return data;
}

/**
 * Soft delete.
 *
 * The ledger and every issued invoice reference this row, so it is never
 * removed — it is hidden from the lists and kept for history.
 */
export async function archiveCustomer(id: string): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(describePostgresError(error, "archive the customer"));
  }

  logger.info("Customer archived", { customerId: id });
}
