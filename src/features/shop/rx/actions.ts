"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/shop/dal";
import { setRxStage } from "@/services/shop/rx.service";

const stageSchema = z.object({
  orderId: z.uuid(),
  stage: z.enum(["booked", "sent", "back"]),
});

/** Move an RX order to the next lab stage, or back a step to undo. */
export async function setRxStageAction(formData: FormData): Promise<void> {
  await requireUser();

  const parsed = stageSchema.safeParse({
    orderId: formData.get("orderId"),
    stage: formData.get("stage"),
  });
  if (!parsed.success) return;

  await setRxStage(parsed.data.orderId, parsed.data.stage);
  revalidatePath("/shop/rx");
  revalidatePath(`/shop/orders/${parsed.data.orderId}`);
}
