"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { expenseSchema } from "@/lib/validations/shop/expense";
import { createExpense, deleteExpense } from "@/services/shop/expense.service";

export interface ExpenseFormState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

/** Add one expense and stay on the page, ready for the next. */
export async function addExpenseAction(
  _previous: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  await requireUser();

  const parsed = expenseSchema.safeParse({
    expenseDate: formData.get("expenseDate") ?? "",
    item: formData.get("item") ?? "",
    amount: formData.get("amount") ?? "",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  try {
    await createExpense(parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Save failed." };
  }

  revalidatePath("/shop/expenses");
  return { message: `Added ${parsed.data.item}.` };
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await deleteExpense(id);
  revalidatePath("/shop/expenses");
}
