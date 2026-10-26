import { z } from "zod";

/** The unlock page may send the browser back only to a path inside the back office. */
const BACK_OFFICE_PATH = /^\/shop(\/[A-Za-z0-9_-]+)*$/;

export const reportUnlockSchema = z.object({
  passcode: z.string().trim().min(1).max(64),
  next: z.string().regex(BACK_OFFICE_PATH).optional(),
});

export type ReportUnlockPayload = z.infer<typeof reportUnlockSchema>;
