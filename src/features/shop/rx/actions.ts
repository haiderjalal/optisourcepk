"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { priceAndInvoiceRx, setRxStage } from "@/services/shop/rx.service";

const stageSchema = z.object({
  orderId: z.uuid(),
  stage: z.enum(["booked", "sent", "back"]),
});

/** Move an RX order to the next lab stage, or back a step to undo. */
export async function setRxStageAction(formData: FormData): Promise<void> {
  await requireUser();

  const parsed = stageSchema.safeParse({
    orderId: formData.get("orderId"),
    stage: formData.get("stage"),
  });
  if (!parsed.success) return;

  await setRxStage(parsed.data.orderId, parsed.data.stage);
  revalidatePath("/shop/rx");
  revalidatePath(`/shop/orders/${parsed.data.orderId}`);
}

const pricingSchema = z.object({
  orderId: z.uuid(),
  salePrice: z.coerce
    .number({ error: "Enter the sale price." })
    .positive("Enter the sale price.")
    .max(9_999_999, "That price is out of range."),
  purchasePrice: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
      error: "Purchase price must be a number, or blank.",
    }),
});

export interface RxInvoiceState {
  error?: string;
}

/** Enter an RX order's prices and issue its invoice, then open the invoice. */
export async function priceAndInvoiceRxAction(
  _previous: RxInvoiceState,
  formData: FormData,
): Promise<RxInvoiceState> {
  await requireUser();

  const parsed = pricingSchema.safeParse({
    orderId: formData.get("orderId"),
    salePrice: formData.get("salePrice"),
    purchasePrice: formData.get("purchasePrice") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the prices." };
  }

  try {
    await priceAndInvoiceRx(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not invoice.",
    };
  }

  revalidatePath("/shop/rx");
  revalidatePath("/shop/invoices");
  redirect(`/shop/orders/${parsed.data.orderId}`);
}
