import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import { describePostgresError } from "./errors";

/**
 * Recently deleted: orders, invoices, stock entries and expenses deleted in
 * the last 7 days, and their restore. Older ones are removed for good each
 * time the list is read.
 */

export const TRASH_DAYS = 7;

export interface DeletedItem {
  /** "expense:<id>" or the trash row id. */
  key: string;
  id: string;
  source: "trash" | "expense";
  kind: "Invoice" | "Order" | "RX order" | "Stock entry" | "Expense";
  label: string;
  deletedAt: string;
  /** Whole days left before it is gone for good (0 = last day). */
  daysLeft: number;
}

function daysLeft(deletedAt: string): number {
  const ms =
    new Date(deletedAt).getTime() + TRASH_DAYS * 86_400_000 - Date.now();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Everything restorable, newest first. Purges what has passed 7 days. */
export async function listRecentlyDeleted(): Promise<{
  items: DeletedItem[];
  /** False when migration 0032 has not been run yet. */
  ready: boolean;
}> {
  const { supabase } = await requireUser();

  const purge = await supabase.rpc("purge_trash");
  if (purge.error) {
    if (purge.error.code === "PGRST202" || purge.error.code === "42883") {
      return { items: [], ready: false };
    }
    throw new Error(
      describePostgresError(purge.error, "load Recently deleted"),
    );
  }

  const since = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
  const [trash, expenses] = await Promise.all([
    supabase
      .from("trash")
      .select("id, kind, label, deleted_at")
      .gte("deleted_at", since)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, item, amount, expense_date, deleted_at")
      .not("deleted_at", "is", null)
      .gte("deleted_at", since)
      .order("deleted_at", { ascending: false }),
  ]);
  if (trash.error || expenses.error) {
    throw new Error(
      describePostgresError(
        trash.error ?? expenses.error,
        "load Recently deleted",
      ),
    );
  }

  const items: DeletedItem[] = [
    ...(trash.data ?? []).map((t): DeletedItem => ({
      key: t.id,
      id: t.id,
      source: "trash",
      kind:
        t.kind === "stock_movement"
          ? "Stock entry"
          : t.label.startsWith("Invoice")
            ? "Invoice"
            : t.label.startsWith("RX-")
              ? "RX order"
              : "Order",
      label: t.label,
      deletedAt: t.deleted_at,
      daysLeft: daysLeft(t.deleted_at),
    })),
    ...(expenses.data ?? []).map((e): DeletedItem => ({
      key: `expense:${e.id}`,
      id: e.id,
      source: "expense",
      kind: "Expense",
      label: `${e.item} — Rs ${e.amount.toLocaleString("en-PK")} (${e.expense_date})`,
      deletedAt: e.deleted_at ?? "",
      daysLeft: daysLeft(e.deleted_at ?? ""),
    })),
  ];

  return {
    items: items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    ready: true,
  };
}

/** Put a deleted order, invoice or stock entry back exactly as it was. */
export async function restoreTrashItem(id: string): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("restore_trash", {
    p_trash_id: id,
  });
  if (error) throw new Error(describePostgresError(error, "restore it"));
  logger.info("Restored from Recently deleted", { id });
  return data;
}

/** Bring a deleted expense back, if it is still within the 7 days. */
export async function restoreExpense(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const since = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("expenses")
    .update({ deleted_at: null })
    .eq("id", id)
    .gte("deleted_at", since)
    .select("id");
  if (error) throw new Error(describePostgresError(error, "restore it"));
  if (!data || data.length === 0) {
    throw new Error(
      "This was deleted more than 7 days ago and can no longer be restored.",
    );
  }
  logger.info("Expense restored", { id });
}
