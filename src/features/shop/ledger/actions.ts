"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { removeLedgerEntry } from "@/services/shop/ledger.service";

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
