"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { dailyStockSchema } from "@/lib/validations/shop/stock";
import { saveDailyStockEntry } from "@/services/shop/daily-stock.service";

export interface DailyStockState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function saveDailyStockAction(
  _previous: DailyStockState,
  formData: FormData,
): Promise<DailyStockState> {
  await requireUser();

  const parsed = dailyStockSchema.safeParse({
    productId: formData.get("productId"),
    entryDate: formData.get("entryDate"),
    openingQty: formData.get("openingQty"),
    receivedQty: formData.get("receivedQty"),
    outgoingQty: formData.get("outgoingQty"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the daily stock entry.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  try {
    const saved = await saveDailyStockEntry(parsed.data);
    revalidatePath("/shop/stock/daily");
    revalidatePath("/shop/stock");
    return {
      message: `${saved.product_name} saved. Closing stock: ${saved.closing_qty} ${saved.unit}.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save.",
    };
  }
}
