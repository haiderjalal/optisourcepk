"use server";

import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import { reportUnlockSchema } from "@/lib/validations/shop/reportUnlock";
import { requireUser } from "@/server/shop/dal";
import {
  passcodeMatches,
  REPORTS_UNLOCK_PATH,
  reportsPasscodeConfigured,
  unlockReports,
} from "@/server/shop/reportLock";

/** Where a correct passcode lands when the page was not told where to go. */
const DEFAULT_REPORT_PATH = "/shop/sales";

/** A form field as text; a missing or non-text field is blank. */
function fieldText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Checks the reports passcode and, when it matches, opens the reports for this
 * browser. A refused attempt is logged without the passcode.
 */
export async function unlockReportsAction(formData: FormData): Promise<void> {
  await requireUser();

  const parsed = reportUnlockSchema.safeParse({
    passcode: fieldText(formData, "passcode"),
    next: fieldText(formData, "next") || undefined,
  });
  const next =
    parsed.success && parsed.data.next ? parsed.data.next : DEFAULT_REPORT_PATH;
  const backTo = (error: "wrong" | "unset") =>
    `${REPORTS_UNLOCK_PATH}?next=${encodeURIComponent(next)}&error=${error}`;

  if (!reportsPasscodeConfigured()) redirect(backTo("unset"));
  if (!parsed.success || !passcodeMatches(parsed.data.passcode)) {
    logger.warn("Reports unlock refused");
    redirect(backTo("wrong"));
  }

  await unlockReports();
  redirect(next);
}
