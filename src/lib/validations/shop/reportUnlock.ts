import { z } from "zod";

/** The reports the passcode locks, by key. */
export const REPORT_KEYS = [
  "sales",
  "ledger",
  "rx-lab-report",
  "stock-report",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

/** The unlock page may send the browser back only to a path inside the back office. */
const BACK_OFFICE_PATH = /^\/shop(\/[A-Za-z0-9_-]+)*$/;

export const reportUnlockSchema = z.object({
  passcode: z.string().trim().min(1).max(64),
  next: z.string().regex(BACK_OFFICE_PATH).optional(),
});
