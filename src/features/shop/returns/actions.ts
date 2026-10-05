"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { deleteReturn, recordReturn } from "@/services/shop/return.service";

export interface ReturnFormState {
  error?: string;
  message?: string;
}

const MAX_QTY = 100_000;

// A return touches the invoice, stock, the daily register, the shop's
// account and the dashboard: refresh the whole back office.
function revalidateAfterReturn() {
  revalidatePath("/shop", "layout");
}

/**
 * Record items a shop sent back from one invoice. Each line's quantity comes
 * from a field named `qty:<order line id>`; blank or 0 means not returned.
 */
export async function recordReturnAction(
  _previous: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  await requireUser();

  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return { error: "That invoice was not found." };

  const lines: { orderLineId: string; qty: number }[] = [];
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("qty:")) continue;
    const lineId = z.uuid().safeParse(name.slice(4));
    const text = String(raw).trim();
    if (!lineId.success || text === "") continue;
    const qty = Number(text);
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
      return { error: "Return quantities are whole numbers of 0 or more." };
    }
    if (qty > 0) lines.push({ orderLineId: lineId.data, qty });
  }
  if (lines.length === 0) {
    return { error: "Enter how many of at least one item came back." };
  }

  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 400);

  try {
    const ret = await recordReturn({
      orderId: orderId.data,
      lines,
      note: note || null,
    });
    revalidateAfterReturn();
    return {
      message: `Return RET-${String(ret.return_no).padStart(4, "0")} recorded — Rs ${Number(ret.amount).toFixed(2)} credited to the shop.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not record it.",
    };
  }
}

/** Undo a return: stock comes off again and the credit is removed. */
export async function deleteReturnAction(formData: FormData): Promise<void> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  await deleteReturn(id.data);
  revalidateAfterReturn();
}
