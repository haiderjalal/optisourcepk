import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database";
import { describePostgresError } from "./errors";
import { selectAllPages } from "./paging";

type TableName = keyof Database["public"]["Tables"];

/**
 * Every table in the back office, in the order they would be restored:
 * parents before the rows that point at them. Each is read with the column it
 * pages on — a stable order is what keeps paging from skipping rows.
 */
const TABLES: { name: TableName; orderBy: string }[] = [
  { name: "counters", orderBy: "name" },
  { name: "customers", orderBy: "id" },
  { name: "suppliers", orderBy: "id" },
  { name: "products", orderBy: "id" },
  { name: "stock_bins", orderBy: "id" },
  { name: "daily_stock_entries", orderBy: "id" },
  { name: "orders", orderBy: "id" },
  { name: "order_lines", orderBy: "id" },
  { name: "daily_stock_postings", orderBy: "id" },
  { name: "purchase_invoices", orderBy: "id" },
  { name: "purchase_invoice_lines", orderBy: "id" },
  { name: "stock_movements", orderBy: "id" },
  { name: "ledger_entries", orderBy: "id" },
  { name: "expenses", orderBy: "id" },
  { name: "sales_returns", orderBy: "id" },
  { name: "sales_return_lines", orderBy: "id" },
  { name: "trash", orderBy: "id" },
];

/**
 * Fails to compile if a table in the database types is not listed above, so a
 * new table cannot be left out of the backup without anyone noticing.
 */
type UnbackedTable = Exclude<TableName, (typeof TABLES)[number]["name"]>;
export const EVERY_TABLE_IS_BACKED_UP: [UnbackedTable] extends [never]
  ? true
  : UnbackedTable = true;

export interface Backup {
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/**
 * A full copy of the back-office data, as the signed-in user sees it.
 *
 * Archived rows (deleted_at set) are included: a backup that leaves out
 * what was hidden cannot put it back.
 */
export async function exportAllData(): Promise<Backup> {
  const { supabase } = await requireUser();

  const read = async ({ name, orderBy }: (typeof TABLES)[number]) => {
    try {
      const rows = await selectAllPages<unknown>((from, to) =>
        supabase.from(name).select("*").order(orderBy).range(from, to),
      );
      return [name, rows] as const;
    } catch (error) {
      throw new Error(describePostgresError(error, `back up ${name}`));
    }
  };

  const tables = Object.fromEntries(await Promise.all(TABLES.map(read)));

  logger.info("Backup exported", {
    rows: Object.values(tables).reduce((sum, rows) => sum + rows.length, 0),
  });

  return { exportedAt: new Date().toISOString(), tables };
}
