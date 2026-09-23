"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { supplierSchema } from "@/lib/validations/shop/supplier";
import {
  createSupplier,
  updateSupplier,
} from "@/services/shop/supplier.service";

export interface SupplierFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
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
