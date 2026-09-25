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
import {
  adjustStock,
  receivePowers,
  receiveRange,
  setReorderLevel,
} from "@/services/shop/stock.service";
import { stockAdjustmentSchema } from "@/lib/validations/shop/stock";
import { purchaseSchema } from "@/lib/validations/shop/purchase";
import { recordPurchase } from "@/services/shop/purchase.service";

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
    sphMin: formData.get("sphMin") ?? "",
    sphMax: formData.get("sphMax") ?? "",
    sphStep: formData.get("sphStep") ?? "",
    cylMin: formData.get("cylMin") ?? "",
    cylMax: formData.get("cylMax") ?? "",
    cylStep: formData.get("cylStep") ?? "",
    addMin: formData.get("addMin") ?? "",
    addMax: formData.get("addMax") ?? "",
    addStep: formData.get("addStep") ?? "",
    axisMin: formData.get("axisMin") ?? "",
    axisMax: formData.get("axisMax") ?? "",
    eyes: formData.get("eyes") ?? "",
    lensSign: formData.get("lensSign") ?? "",
    alertQty: formData.get("alertQty") ?? "",
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

export interface RangeFillState {
  error?: string;
  message?: string;
}

/**
 * Create every bin in the product's range at once.
 *
 * Stays on the page and reports how many bins were touched, because the point
 * of it is to avoid a long walk back and forth.
 */
export async function receiveRangeAction(
  _previous: RangeFillState,
  formData: FormData,
): Promise<RangeFillState> {
  await requireUser();

  const productId = formData.get("productId");
  if (typeof productId !== "string" || !productId) {
    return { error: "That product was not found." };
  }

  const qty = Number(formData.get("qty"));
  const alertRaw = String(formData.get("alertQty") ?? "").trim();
  const alert = alertRaw === "" ? null : Number(alertRaw);

  if (!Number.isInteger(qty) || qty < 0) {
    return { error: "Enter a whole quantity of zero or more." };
  }
  if (alert !== null && (!Number.isInteger(alert) || alert < 0)) {
    return { error: "The alert quantity must be a whole number." };
  }

  try {
    const bins = await receiveRange(productId, qty, alert);
    revalidatePath(`/shop/products/${productId}`);
    revalidatePath("/shop/stock");
    return {
      message:
        qty === 0
          ? `Created ${bins} bins, all empty.`
          : `Filled ${bins} bins with ${qty} each.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not fill it.",
    };
  }
}

export interface PowerGridState {
  error?: string;
  message?: string;
  /** Set when the delivery was recorded against a purchase invoice. */
  purchaseId?: string;
}

/**
 * Receive a grid of powers at once.
 *
 * The grid posts its quantities as one JSON field rather than as a form input
 * per square: a wide range is a hundred inputs, and indexed-name parsing is a
 * class of bug worth not having.
 *
 * With a supplier picked, the delivery becomes lines on that supplier's
 * purchase invoice and the stock moves inside `record_purchase`. Without one
 * it is opening stock, received with no invoice behind it.
 */
export async function receivePowersAction(
  _previous: PowerGridState,
  formData: FormData,
): Promise<PowerGridState> {
  await requireUser();

  const productId = formData.get("productId");
  if (typeof productId !== "string" || !productId) {
    return { error: "That product was not found." };
  }

  let entries: {
    sph: number | null;
    cyl?: number | null;
    add?: number | null;
    qty: number;
  }[] = [];
  try {
    const raw = formData.get("entries");
    entries = typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    return { error: "Could not read the quantities." };
  }

  const clean = entries.filter((e) => Number.isInteger(e.qty) && e.qty !== 0);

  if (clean.length === 0) {
    return { error: "Enter a quantity against at least one power." };
  }
  if (clean.some((e) => e.qty < 0)) {
    return {
      error:
        "Quantities here are what arrived, so they cannot be negative. Use the product page to write stock off.",
    };
  }

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const num = (name: string) => (text(name) === "" ? null : Number(text(name)));
  const eyeRaw = text("eye");
  const eye = eyeRaw === "R" || eyeRaw === "L" ? eyeRaw : null;
  // The grid posts per-square CYL or ADD in each entry; the other one comes
  // from the batch field.
  const addPower = num("addPower");
  const batchCyl = num("cyl");
  const supplierId = text("supplierId");
  const total = clean.reduce((sum, e) => sum + e.qty, 0);

  try {
    if (supplierId) {
      const parsed = purchaseSchema.safeParse({
        supplierId,
        invoiceNo: text("invoiceNo"),
        invoiceDate: text("invoiceDate"),
        lines: clean.map((e) => ({
          productId,
          sph: e.sph,
          cyl: e.cyl ?? batchCyl,
          add: e.add ?? addPower,
          eye,
          qty: e.qty,
          unitCost: num("unitCost"),
        })),
      });
      if (!parsed.success) {
        return {
          error: parsed.error.issues[0]?.message ?? "Check the invoice.",
        };
      }

      const purchaseId = await recordPurchase({
        supplierId: parsed.data.supplierId,
        invoiceNo: parsed.data.invoiceNo,
        invoiceDate: parsed.data.invoiceDate,
        lines: parsed.data.lines,
        notes: null,
      });

      revalidatePath(`/shop/products/${productId}`);
      revalidatePath("/shop/stock");
      revalidatePath("/shop/purchases");
      return {
        message: `Received ${total} on invoice ${parsed.data.invoiceNo}.`,
        purchaseId,
      };
    }

    const bins = await receivePowers({
      productId,
      entries: clean,
      cyl: batchCyl,
      addPower,
      eye,
      alertQty: null,
      reason: "purchase",
      note: text("note") || "Opening stock",
    });

    revalidatePath(`/shop/products/${productId}`);
    revalidatePath("/shop/stock");

    return {
      message: `Received ${total} across ${bins} ${bins === 1 ? "power" : "powers"}.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not receive it.",
    };
  }
}
