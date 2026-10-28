"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import {
  issueRxInvoice,
  priceRx,
  removeRxFromInvoice,
  setRxCost,
  setRxHold,
  setRxStage,
  updateRxLabOrderNo,
  voidAndRebillRxInvoice,
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

const holdSchema = z
  .object({
    orderId: z.uuid(),
    onHold: z.enum(["true", "false"]).transform((value) => value === "true"),
    reason: z
      .string()
      .trim()
      .max(200, "The reason for the hold can be 200 characters at most."),
  })
  .refine((input) => !input.onHold || input.reason !== "", {
    error: "Enter the reason for the hold.",
    path: ["reason"],
  });

/** Put an RX order on hold at the lab, with the reason, or release the hold. */
export async function setRxHoldAction(
  _previous: RxActionState,
  formData: FormData,
): Promise<RxActionState> {
  await requireUser();

  const parsed = holdSchema.safeParse({
    orderId: formData.get("orderId"),
    onHold: formData.get("onHold"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the hold." };
  }

  try {
    await setRxHold(
      parsed.data.orderId,
      parsed.data.onHold,
      parsed.data.reason,
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save.",
    };
  }

  revalidatePath("/shop/rx");
  revalidatePath(`/shop/orders/${parsed.data.orderId}`);
  return {
    message: parsed.data.onHold
      ? "On hold. The reason is in the notes."
      : "Hold released.",
    saved: true,
  };
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

  // The number shows on the RX list, the job, the WhatsApp text and the
  // customer statements, so every page under /shop is refreshed.
  revalidatePath("/shop", "layout");
  return {
    message: "Lab order number saved.",
    saved: true,
    labOrderNo: parsed.data.labOrderNo,
  };
}

/**
 * Take a duplicate RX order off its shop's combined invoice, recalculate that
 * invoice, then move the order to Recently deleted (restorable for 7 days).
 */
export async function removeRxFromInvoiceAction(
  _previous: RxActionState,
  formData: FormData,
): Promise<RxActionState> {
  await requireUser();

  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return { error: "Choose an RX order." };

  try {
    await removeRxFromInvoice(orderId.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not remove it.",
    };
  }

  // The lens is off the invoice already. If the order cannot be moved to
  // Recently deleted, say so: it would otherwise show as a new order to invoice.
  revalidatePath("/shop", "layout");
  try {
    await deleteOrder(orderId.data);
  } catch (error) {
    return {
      error:
        `Removed from the invoice, but it could not be moved to Recently deleted. ${error instanceof Error ? error.message : ""}`.trim(),
    };
  }

  return { message: "Removed from the invoice and moved to Recently deleted." };
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

/** Void a combined RX invoice and bill its RX orders again as one new invoice. */
export async function voidAndRebillRxAction(formData: FormData): Promise<void> {
  await requireUser();

  const invoiceId = z.uuid().safeParse(formData.get("orderId"));
  if (!invoiceId.success) return;

  const newInvoiceId = await voidAndRebillRxInvoice(
    invoiceId.data,
    "Billed again as a new RX invoice",
  );

  revalidatePath("/shop/invoices");
  revalidatePath("/shop/rx");
  revalidatePath(`/shop/orders/${invoiceId.data}`);
  redirect(`/shop/orders/${newInvoiceId}`);
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
