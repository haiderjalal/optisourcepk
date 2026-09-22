"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { productSchema } from "@/lib/validations/shop/product";
import {
  archiveProduct,
  createProduct,
  updateProduct,
} from "@/services/shop/product.service";
import { adjustStock, setReorderLevel } from "@/services/shop/stock.service";
import { stockAdjustmentSchema } from "@/lib/validations/shop/stock";

export interface ProductFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function saveProduct(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireUser();

  const parsed = productSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    listPrice: formData.get("listPrice") ?? 0,
    purchasePrice: formData.get("purchasePrice") ?? 0,
    // An unchecked checkbox sends nothing at all.
    tracksPower: formData.get("tracksPower") === "on",
    tracksCyl: formData.get("tracksCyl") === "on",
    tracksAdd: formData.get("tracksAdd") === "on",
    tracksEye: formData.get("tracksEye") === "on",
    tracksStock: formData.get("tracksStock") === "on",
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
    if (isUpdate) await updateProduct(id, parsed.data);
    else await createProduct(parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Save failed." };
  }

  revalidatePath("/shop/products");
  if (isUpdate) revalidatePath(`/shop/products/${id}`);
  redirect("/shop/products");
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await archiveProduct(id);
  revalidatePath("/shop/products");
  redirect("/shop/products");
}

export interface StockFormState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Receive, return or correct stock for one power.
 *
 * Stays on the page and reports the new quantity: stock is entered in runs of
 * many powers, and bouncing back to a list after each one would be tedious.
 */
export async function adjustStockAction(
  _previous: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  await requireUser();

  const parsed = stockAdjustmentSchema.safeParse({
    productId: formData.get("productId"),
    sph: formData.get("sph") ?? "",
    cyl: formData.get("cyl") ?? "",
    addPower: formData.get("addPower") ?? "",
    eye: formData.get("eye") ?? "",
    delta: formData.get("delta"),
    reason: formData.get("reason"),
    alertQty: formData.get("alertQty") ?? "",
    note: formData.get("note") ?? "",
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
    const qty = await adjustStock({
      productId: parsed.data.productId,
      sph: parsed.data.sph,
      cyl: parsed.data.cyl,
      addPower: parsed.data.addPower,
      eye:
        parsed.data.eye === "R" || parsed.data.eye === "L"
          ? parsed.data.eye
          : null,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      alertQty: parsed.data.alertQty,
      note: parsed.data.note || null,
    });

    revalidatePath(`/shop/products/${parsed.data.productId}`);
    revalidatePath("/shop/stock");

    const power =
      parsed.data.sph === null
        ? ""
        : ` at ${parsed.data.sph > 0 ? "+" : ""}${parsed.data.sph.toFixed(2)}`;

    return { message: `Updated${power}. Now ${qty} on hand.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Adjustment failed.",
    };
  }
}

export async function setReorderLevelAction(formData: FormData): Promise<void> {
  await requireUser();

  const binId = formData.get("binId");
  const level = Number(formData.get("reorderLevel"));
  const productId = formData.get("productId");

  if (typeof binId !== "string" || !binId) return;
  if (!Number.isInteger(level) || level < 0) return;

  await setReorderLevel(binId, level);

  if (typeof productId === "string") {
    revalidatePath(`/shop/products/${productId}`);
  }
  revalidatePath("/shop/stock");
}
