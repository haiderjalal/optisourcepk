"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { ledgerEntryEditSchema } from "@/lib/validations/shop/payment";
import {
  removeLedgerEntry,
  updateLedgerEntry,
} from "@/services/shop/ledger.service";

export interface LedgerActionState {
  error?: string;
  message?: string;
}

/** Move a payment or adjustment entered by hand into Recently deleted. */
export async function removeLedgerEntryAction(
  _previous: LedgerActionState,
  formData: FormData,
): Promise<LedgerActionState> {
  await requireUser();

  const entryId = z.uuid().safeParse(formData.get("entryId"));
  if (!entryId.success) return { error: "Choose an entry to remove." };

  try {
    await removeLedgerEntry(entryId.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not remove it.",
    };
  }

  // Every balance that follows the entry moves, so every page under /shop is refreshed.
  revalidatePath("/shop", "layout");
  return { message: "Removed. It is in Recently deleted for 7 days." };
}

/**
 * Save a correction to a payment or adjustment entered by hand. The database
 * checks the rest (a payment needs a method, and the entry must be one that can
 * be edited here).
 */
export async function updateLedgerEntryAction(
  _previous: LedgerActionState,
  formData: FormData,
): Promise<LedgerActionState> {
  await requireUser();

  const parsed = ledgerEntryEditSchema.safeParse({
    entryId: formData.get("entryId"),
    amount: formData.get("amount"),
    method: formData.get("method") || undefined,
    reference: formData.get("reference") ?? "",
    memo: formData.get("memo") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the entry." };
  }

  try {
    await updateLedgerEntry({
      entryId: parsed.data.entryId,
      amount: parsed.data.amount,
      method: parsed.data.method ?? null,
      reference: parsed.data.reference || null,
      memo: parsed.data.memo || null,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save it.",
    };
  }

  revalidatePath("/shop", "layout");
  redirect("/shop/payments");
}
