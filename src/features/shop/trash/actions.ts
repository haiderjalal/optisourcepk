"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import {
  restoreExpense,
  restoreTrashItem,
} from "@/services/shop/trash.service";

export interface RestoreState {
  error?: string;
  restored?: string;
}

const restoreSchema = z.object({
  id: z.uuid(),
  source: z.enum(["trash", "expense"]),
});

/** Put one item from Recently deleted back where it came from. */
export async function restoreAction(
  _previous: RestoreState,
  formData: FormData,
): Promise<RestoreState> {
  await requireUser();

  const parsed = restoreSchema.safeParse({
    id: formData.get("id"),
    source: formData.get("source"),
  });
  if (!parsed.success) return { error: "That item could not be read." };

  let label = "Expense";
  try {
    if (parsed.data.source === "expense") {
      await restoreExpense(parsed.data.id);
    } else {
      label = await restoreTrashItem(parsed.data.id);
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Restore failed.",
    };
  }

  // Whatever came back reappears on its own page.
  for (const path of [
    "/shop/trash",
    "/shop/orders",
    "/shop/invoices",
    "/shop/rx",
    "/shop/stock",
    "/shop/expenses",
    "/shop/customers",
  ]) {
    revalidatePath(path);
  }
  return { restored: label };
}
