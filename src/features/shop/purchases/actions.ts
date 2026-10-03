"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { purchaseSchema } from "@/lib/validations/shop/purchase";
import {
  recordPurchase,
  setPurchaseLineCost,
} from "@/services/shop/purchase.service";

export interface PurchaseFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/** Read the JSON lines field; a malformed one reads as no lines. */
function readLines(formData: FormData): unknown {
  const raw = formData.get("lines");
  try {
    return typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function savePurchase(
  _previous: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  await requireUser();

  const parsed = purchaseSchema.safeParse({
    supplierId: formData.get("supplierId"),
    invoiceNo: formData.get("invoiceNo") ?? "",
    invoiceDate: formData.get("invoiceDate") ?? "",
    notes: formData.get("notes") ?? "",
    lines: readLines(formData),
  });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    // Line errors arrive nested; surface the first one as the form message.
    const lineIssue = parsed.error.issues.find((i) => i.path[0] === "lines");
    const lineNo = lineIssue?.path[1];
    return {
      error: !lineIssue
        ? "Check the highlighted fields."
        : typeof lineNo === "number"
          ? `Line ${lineNo + 1}: ${lineIssue.message}`
          : lineIssue.message,
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  let id: string;
  try {
    id = await recordPurchase({
      supplierId: parsed.data.supplierId,
      invoiceNo: parsed.data.invoiceNo,
      invoiceDate: parsed.data.invoiceDate,
      lines: parsed.data.lines,
      notes: parsed.data.notes || null,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save it.",
    };
  }

  revalidatePath("/shop/purchases");
  revalidatePath("/shop/stock");
  revalidatePath("/shop");
  redirect(`/shop/purchases/${id}`);
}

const costSchema = z.object({
  lineId: z.uuid(),
  purchaseId: z.uuid(),
  unitCost: z.coerce
    .number({ error: "Enter a cost." })
    .min(0, "A cost cannot be negative.")
    .max(9_999_999, "That cost is out of range."),
});

export interface CostState {
  error?: string;
  saved?: boolean;
}

/** Change one purchase line's cost and refresh the invoice. */
export async function setPurchaseCostAction(
  _previous: CostState,
  formData: FormData,
): Promise<CostState> {
  await requireUser();

  const parsed = costSchema.safeParse({
    lineId: formData.get("lineId"),
    purchaseId: formData.get("purchaseId"),
    unitCost: formData.get("unitCost"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the cost." };
  }

  try {
    await setPurchaseLineCost(parsed.data.lineId, parsed.data.unitCost);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Save failed." };
  }

  revalidatePath(`/shop/purchases/${parsed.data.purchaseId}`);
  revalidatePath("/shop/purchases");
  return { saved: true };
}
