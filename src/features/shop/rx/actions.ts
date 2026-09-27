"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { setRxReceived } from "@/services/shop/rx.service";

const receiveSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(20),
  received: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** Mark an RX job's lenses as back from the lab, or undo a mistaken mark. */
export async function setRxReceivedAction(formData: FormData): Promise<void> {
  await requireUser();

  const parsed = receiveSchema.safeParse({
    ids: formData.getAll("id"),
    received: formData.get("received"),
  });
  if (!parsed.success) return;

  await setRxReceived(parsed.data.ids, parsed.data.received);
  revalidatePath("/shop/rx");
}
