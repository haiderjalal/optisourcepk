import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { ExpensePayload } from "@/lib/validations/shop/expense";
import type { Expense } from "@/types/database";
import { describePostgresError } from "./errors";

/** Shop running costs, read one month at a time. */

/** First day of `YYYY-MM` and first day of the month after it. */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const next =
    m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${month}-01`, end: `${next}-01` };
}

export async function listExpenses(month: string): Promise<Expense[]> {
  const { supabase } = await requireUser();
  const { start, end } = monthBounds(month);

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .is("deleted_at", null)
    .gte("expense_date", start)
    .lt("expense_date", end)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(describePostgresError(error, "load expenses"));
  return data ?? [];
}

export async function createExpense(payload: ExpensePayload): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("expenses").insert({
    expense_date: payload.expenseDate,
    item: payload.item,
    amount: payload.amount,
    note: payload.note || null,
  });

  if (error) throw new Error(describePostgresError(error, "save the expense"));
  logger.info("Expense added", { date: payload.expenseDate });
}

/** Hidden, not removed, so a mistaken delete can be recovered. */
export async function deleteExpense(id: string): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(describePostgresError(error, "delete the expense"));
  }
  logger.info("Expense deleted", { expenseId: id });
}
