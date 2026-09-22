"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import {
  orderSchema,
  issueInvoiceSchema,
} from "@/lib/validations/shop/invoice";
import { paymentSchema } from "@/lib/validations/shop/payment";
import {
  createOrder,
  issueInvoice,
  updateDelivery,
  updateOrder,
  voidInvoice,
  deleteOrder,
} from "@/services/shop/invoice.service";
import { recordPayment } from "@/services/shop/ledger.service";

/**
 * Order, invoice and payment mutations.
 *
 * Every one re-checks the session first: a Server Function is a POST to the
 * route that uses it, so the proxy's matcher is not a guarantee it ran.
 */

export interface OrderFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * The builder posts its lines as one JSON field rather than as indexed form
 * inputs — the rows are dynamic, and `lines[3][sph]` parsing is a class of bug
 * worth not having.
 */
function readOrder(formData: FormData) {
  const raw = formData.get("lines");
  let lines: unknown = [];
  try {
    lines = typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    lines = [];
  }

  return {
    customerId: formData.get("customerId"),
    externalOrderRef: formData.get("externalOrderRef") ?? "",
    priority: formData.get("priority") ?? "normal",
    orderByName: formData.get("orderByName") ?? "",
    deliverToName: formData.get("deliverToName") ?? "",
    deliverToAddress: formData.get("deliverToAddress") ?? "",
    deliverToArea: formData.get("deliverToArea") ?? "",
    deliverToPhone: formData.get("deliverToPhone") ?? "",
    courierName: formData.get("courierName") ?? "",
    trackingNo: formData.get("trackingNo") ?? "",
    notes: formData.get("notes") ?? "",
    lines,
  };
}

export async function saveOrder(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  await requireUser();

  const parsed = orderSchema.safeParse(readOrder(formData));

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      error:
        flat.formErrors[0] ??
        "Check the highlighted fields — every line needs a product and a quantity.",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const id = formData.get("id");
  const isUpdate = typeof id === "string" && id.length > 0;

  let orderId: string;
  try {
    const order = isUpdate
      ? await updateOrder(id, parsed.data)
      : await createOrder(parsed.data);
    orderId = order.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Save failed." };
  }

  revalidatePath("/shop/orders");
  redirect(`/shop/orders/${orderId}`);
}

export interface IssueState {
  error?: string;
}

/**
 * Issue the invoice.
 *
 * The heavy lifting is one database transaction — stock off the bins, the
 * number taken, totals computed from the stored lines, the ledger posted. If
 * any part fails, none of it happened and the message says why.
 */
export async function issueInvoiceAction(
  _previous: IssueState,
  formData: FormData,
): Promise<IssueState> {
  await requireUser();

  const parsed = issueInvoiceSchema.safeParse({
    orderId: formData.get("orderId"),
    freight: formData.get("freight") ?? 0,
    gstRate: formData.get("gstRate") ?? 0,
    additionalTaxRate: formData.get("additionalTaxRate") ?? 0,
  });

  if (!parsed.success) {
    return { error: "Check the freight and tax figures." };
  }

  try {
    await issueInvoice(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not issue.",
    };
  }

  revalidatePath(`/shop/orders/${parsed.data.orderId}`);
  revalidatePath("/shop/orders");
  revalidatePath("/shop/invoices");
  revalidatePath("/shop");
  redirect(`/shop/orders/${parsed.data.orderId}`);
}

export async function voidInvoiceAction(formData: FormData): Promise<void> {
  await requireUser();

  const id = formData.get("orderId");
  const reason = formData.get("reason");

  if (typeof id !== "string" || !id) return;

  await voidInvoice(
    id,
    typeof reason === "string" && reason.trim()
      ? reason.trim()
      : "No reason given",
  );

  revalidatePath(`/shop/orders/${id}`);
  revalidatePath("/shop/invoices");
  revalidatePath("/shop");
}

/**
 * Delete a draft.
 *
 * Refused for anything issued — the service says so, and the foreign keys on
 * the ledger and stock movements would refuse it anyway.
 */
export async function deleteOrderAction(formData: FormData): Promise<void> {
  await requireUser();

  const id = formData.get("orderId");
  if (typeof id !== "string" || !id) return;

  await deleteOrder(id);

  revalidatePath("/shop/orders");
  revalidatePath("/shop");
  redirect("/shop/orders");
}

export async function markDispatchedAction(formData: FormData): Promise<void> {
  await requireUser();

  const id = formData.get("orderId");
  if (typeof id !== "string" || !id) return;

  await updateDelivery({
    orderId: id,
    status: "dispatched",
    courierName: String(formData.get("courierName") ?? "").trim() || null,
    trackingNo: String(formData.get("trackingNo") ?? "").trim() || null,
  });

  revalidatePath(`/shop/orders/${id}`);
  revalidatePath("/shop/orders");
}

export async function markDeliveredAction(formData: FormData): Promise<void> {
  await requireUser();

  const id = formData.get("orderId");
  if (typeof id !== "string" || !id) return;

  await updateDelivery({
    orderId: id,
    status: "delivered",
    deliveredBy: String(formData.get("deliveredBy") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  revalidatePath(`/shop/orders/${id}`);
  revalidatePath("/shop/orders");
}

export interface PaymentFormState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function recordPaymentAction(
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  await requireUser();

  const parsed = paymentSchema.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    entryDate: formData.get("entryDate"),
    reference: formData.get("reference") ?? "",
    memo: formData.get("memo") ?? "",
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
    await recordPayment(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not record it.",
    };
  }

  revalidatePath("/shop/payments");
  revalidatePath(`/shop/customers/${parsed.data.customerId}`);
  revalidatePath("/shop/customers");
  revalidatePath("/shop");

  return { message: "Payment recorded." };
}
