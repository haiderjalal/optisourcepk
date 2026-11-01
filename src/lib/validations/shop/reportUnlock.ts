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

/** Each report lives at `/shop/{key}`, with its months and PDFs beneath it. */
const REPORT_PATH = new RegExp(`^/shop/(${REPORT_KEYS.join("|")})(/|$)`);

/** The report a back-office path belongs to, or null for any other page. */
export function reportKeyForPath(pathname: string): ReportKey | null {
  const key = REPORT_PATH.exec(pathname)?.[1];
  return key !== undefined && isReportKey(key) ? key : null;
}

/** The unlock page may send the browser back only to a path inside the back office. */
const BACK_OFFICE_PATH = /^\/shop(\/[A-Za-z0-9_-]+)*$/;

export const reportUnlockSchema = z.object({
  passcode: z.string().trim().min(1).max(64),
  next: z.string().regex(BACK_OFFICE_PATH).optional(),
});
