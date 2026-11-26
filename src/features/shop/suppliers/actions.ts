"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { supplierSchema } from "@/lib/validations/shop/supplier";
import { supplierPaymentSchema } from "@/lib/validations/shop/supplier-payment";
import {
  createSupplier,
  updateSupplier,
} from "@/services/shop/supplier.service";
import { recordSupplierPayment } from "@/services/shop/supplier-payment.service";

export interface SupplierFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export interface SupplierPaymentState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
}

export async function saveSupplier(
  _previous: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  await requireUser();

  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    city: formData.get("city") ?? "",
    address: formData.get("address") ?? "",
    notes: formData.get("notes") ?? "",
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

  const id = formData.get("id");
  const isUpdate = typeof id === "string" && id.length > 0;

  try {
    if (isUpdate) await updateSupplier(id, parsed.data);
    else await createSupplier(parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Save failed." };
  }

  revalidatePath("/shop/suppliers");
  if (isUpdate) revalidatePath(`/shop/suppliers/${id}`);
  redirect("/shop/suppliers");
}

/** Record money sent to a supplier against one of their purchase invoices. */
export async function recordSupplierPaymentAction(
  supplierId: string,
  _previous: SupplierPaymentState,
  formData: FormData,
): Promise<SupplierPaymentState> {
  await requireUser();

  const parsed = supplierPaymentSchema.safeParse({
    purchaseInvoiceId: formData.get("purchaseInvoiceId"),
    amount: formData.get("amount"),
    paymentDate: formData.get("paymentDate") ?? "",
    method: formData.get("method"),
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
    await recordSupplierPayment(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not record it.",
    };
  }

  revalidatePath(`/shop/suppliers/${supplierId}`);
  revalidatePath("/shop/suppliers");
  return { message: "Payment recorded." };
}
