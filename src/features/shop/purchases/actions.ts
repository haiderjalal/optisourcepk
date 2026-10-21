"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import {
  purchaseSchema,
  type PurchasePayload,
} from "@/lib/validations/shop/purchase";
import {
  recordPurchase,
  setPurchaseLineCost,
  updatePurchase,
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

/** Check the posted purchase; a mistake comes back as the form's message. */
function readPurchaseForm(
  formData: FormData,
):
  | { ok: true; data: PurchasePayload }
  | { ok: false; state: PurchaseFormState } {
  const parsed = purchaseSchema.safeParse({
    supplierId: formData.get("supplierId"),
    invoiceNo: formData.get("invoiceNo") ?? "",
    invoiceDate: formData.get("invoiceDate") ?? "",
    notes: formData.get("notes") ?? "",
    lines: readLines(formData),
  });

  if (parsed.success) return { ok: true, data: parsed.data };

  const flat = z.flattenError(parsed.error);
  // Line errors arrive nested; surface the first one as the form message.
  const lineIssue = parsed.error.issues.find((i) => i.path[0] === "lines");
  const lineNo = lineIssue?.path[1];
  return {
    ok: false,
    state: {
      error: !lineIssue
        ? "Check the highlighted fields."
        : typeof lineNo === "number"
          ? `Line ${lineNo + 1}: ${lineIssue.message}`
          : lineIssue.message,
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    },
  };
}

export async function savePurchase(
  _previous: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  await requireUser();

  const form = readPurchaseForm(formData);
  if (!form.ok) return form.state;

  let id: string;
  try {
    id = await recordPurchase({
      supplierId: form.data.supplierId,
      invoiceNo: form.data.invoiceNo,
      invoiceDate: form.data.invoiceDate,
      lines: form.data.lines,
      notes: form.data.notes || null,
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

/**
 * Save the changes to a purchase: its header, its lines, and the stock they
 * moved. The database refuses a change that would take stock below what is on
 * the shelf, and then nothing is saved.
 */
export async function updatePurchaseAction(
  _previous: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  await requireUser();

  const purchaseId = z.uuid().safeParse(formData.get("purchaseId"));
  if (!purchaseId.success) return { error: "Choose the purchase to change." };

  const form = readPurchaseForm(formData);
  if (!form.ok) return form.state;

  let id: string;
  try {
    id = await updatePurchase({
      purchaseId: purchaseId.data,
      supplierId: form.data.supplierId,
      invoiceNo: form.data.invoiceNo,
      invoiceDate: form.data.invoiceDate,
      lines: form.data.lines,
      notes: form.data.notes || null,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save it.",
    };
  }

  revalidatePath(`/shop/purchases/${id}`);
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
