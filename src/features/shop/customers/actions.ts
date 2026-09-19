"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { customerSchema } from "@/lib/validations/shop/customer";
import {
  archiveCustomer,
  createCustomer,
  updateCustomer,
} from "@/services/shop/customer.service";

/**
 * Customer mutations.
 *
 * Each one calls `requireUser()` first. A Server Function is a POST to the
 * route that uses it, so the proxy's matcher is not a guarantee it ran — the
 * check has to be here.
 */

export interface CustomerFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function readForm(formData: FormData) {
  return {
    customerName: formData.get("customerName"),
    shopName: formData.get("shopName"),
    area: formData.get("area"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    phoneAlt: formData.get("phoneAlt") ?? "",
    ntn: formData.get("ntn") ?? "",
    strn: formData.get("strn") ?? "",
    defaultDiscountPct: formData.get("defaultDiscountPct") ?? 0,
    openingBalance: formData.get("openingBalance") ?? 0,
    openingBalanceDate: formData.get("openingBalanceDate"),
    notes: formData.get("notes") ?? "",
  };
}

export async function saveCustomer(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireUser();

  const parsed = customerSchema.safeParse(readForm(formData));

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
    if (isUpdate) {
      await updateCustomer(id, parsed.data);
    } else {
      await createCustomer(parsed.data);
    }
  } catch (error) {
    // The service has already logged the cause and phrased this for a person.
    return { error: error instanceof Error ? error.message : "Save failed." };
  }

  revalidatePath("/shop/customers");
  if (isUpdate) revalidatePath(`/shop/customers/${id}`);
  redirect("/shop/customers");
}

export async function archiveCustomerAction(formData: FormData): Promise<void> {
  await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await archiveCustomer(id);
  revalidatePath("/shop/customers");
  redirect("/shop/customers");
}
