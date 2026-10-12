import "server-only";

import { requireUser } from "@/server/shop/dal";
import type { LedgerRow, LedgerType } from "@/features/shop/ledger/summary";
import { readAllRows } from "./paged";

interface EntryRow {
  id: string;
  entry_type: LedgerType;
  amount: number | string;
  entry_date: string;
  payment_method: string | null;
  customers: { customer_name: string; shop_name: string } | null;
}

/** Ledger entries dated within the range (inclusive, Karachi calendar dates), newest first. */
export async function listLedgerEntries(range: { from: string; to: string }): Promise<LedgerRow[]> {
  const { supabase } = await requireUser();
  const rows = await readAllRows<EntryRow>("load ledger entries", (from, to) =>
    supabase
      .from("ledger_entries")
      .select("id, entry_type, amount, entry_date, payment_method, customers!inner(customer_name, shop_name)")
      .gte("entry_date", range.from)
      .lte("entry_date", range.to)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  return rows.flatMap((row) => {
    if (!row.customers) return [];
    return [
      {
        id: row.id,
        entryDate: row.entry_date,
        entryType: row.entry_type,
        amount: Number(row.amount),
        customerName: row.customers.customer_name,
        shopName: row.customers.shop_name,
        paymentMethod: row.payment_method,
      },
    ];
  });
}
