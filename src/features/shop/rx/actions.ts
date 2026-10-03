"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import {
  issueRxInvoice,
  priceRx,
  setRxCost,
  setRxStage,
  updateRxLabOrderNo,
} from "@/services/shop/rx.service";
import { deleteOrder } from "@/services/shop/invoice.service";

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
  labOrderNo: z
    .string()
    .trim()
    .max(80, "Lab order number is too long.")
    .transform((v) => v || null),
});

export interface RxActionState {
  error?: string;
  message?: string;
  saved?: boolean;
  labOrderNo?: string;
}

const labOrderNumberSchema = z.object({
  orderId: z.uuid(),
  labOrderNo: z
    .string()
    .trim()
    .min(1, "Enter the lab order number.")
    .max(80, "Lab order number is too long."),
});

/** Save only the reference supplied by the lab; never issue the invoice. */
export async function saveLabOrderNumberAction(
  _previous: RxActionState,
  formData: FormData,
): Promise<RxActionState> {
  await requireUser();

  const parsed = labOrderNumberSchema.safeParse({
    orderId: formData.get("orderId"),
    labOrderNo: formData.get("labOrderNo"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the lab order number.",
    };
  }

  try {
    await updateRxLabOrderNo(parsed.data.orderId, parsed.data.labOrderNo);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save.",
    };
  }

  revalidatePath("/shop/rx");
  revalidatePath(`/shop/orders/${parsed.data.orderId}`);
  return {
    message: "Lab order number saved. Generate the invoice whenever you want.",
    saved: true,
    labOrderNo: parsed.data.labOrderNo,
  };
}

/** Save an RX order's prices; it is then ready for the shop's invoice. */
export async function priceRxAction(
  _previous: RxActionState,
  formData: FormData,
): Promise<RxActionState> {
  await requireUser();

  const parsed = pricingSchema.safeParse({
    orderId: formData.get("orderId"),
    salePrice: formData.get("salePrice"),
    purchasePrice: formData.get("purchasePrice") ?? "",
    labOrderNo: formData.get("labOrderNo") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the prices." };
  }

  try {
    await priceRx(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save.",
    };
  }

  revalidatePath("/shop/rx");
  revalidatePath(`/shop/orders/${parsed.data.orderId}`);
  return { message: "Saved — ready to invoice." };
}

/** One invoice for all of a shop's ready RX orders, then open it. */
export async function issueRxInvoiceAction(
  _previous: RxActionState,
  formData: FormData,
): Promise<RxActionState> {
  await requireUser();

  const customerId = z.uuid().safeParse(formData.get("customerId"));
  if (!customerId.success) return { error: "Pick a shop." };

  let invoiceId: string;
  try {
    invoiceId = await issueRxInvoice(customerId.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not invoice.",
    };
  }

  revalidatePath("/shop/rx");
  revalidatePath("/shop/invoices");
  redirect(`/shop/orders/${invoiceId}`);
}

/** Delete an RX order that has not been invoiced yet. */
export async function deleteRxOrderAction(formData: FormData): Promise<void> {
  await requireUser();

  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return;

  await deleteOrder(orderId.data);
  revalidatePath("/shop/rx");
  revalidatePath("/shop");
  redirect("/shop/rx");
}

const costSchema = z.object({
  orderId: z.uuid(),
  unitCost: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 9_999_999),
      {
        error: "Purchase price must be a number, or blank.",
      },
    ),
});

/** Change an invoiced RX order's purchase price (per lens). */
export async function setRxCostAction(
  _previous: RxActionState,
  formData: FormData,
): Promise<RxActionState> {
  await requireUser();

  const parsed = costSchema.safeParse({
    orderId: formData.get("orderId"),
    unitCost: formData.get("unitCost") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the price." };
  }

  try {
    await setRxCost(parsed.data.orderId, parsed.data.unitCost);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Save failed." };
  }

  revalidatePath(`/shop/orders/${parsed.data.orderId}`);
  revalidatePath("/shop/rx");
  return { message: "Purchase price saved." };
}
