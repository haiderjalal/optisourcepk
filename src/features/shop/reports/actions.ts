"use server";

import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import {
  isReportKey,
  reportUnlockSchema,
} from "@/lib/validations/shop/reportUnlock";
import { requireUser } from "@/server/shop/dal";
import {
  passcodeMatches,
  REPORTS_UNLOCK_PATH,
  reportsPasscodeConfigured,
  unlockReports,
} from "@/server/shop/reportLock";

/** Where a correct passcode lands when the page was not told where to go. */
const DEFAULT_REPORT_PATH = "/shop/sales";

type UnlockError = "report" | "unset" | "wrong";

/** A form field as text; a missing or non-text field is blank. */
function fieldText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Checks the reports passcode and, when it matches, opens that report for this
 * browser in place of any other. A refused attempt is logged without the passcode.
 */
export async function unlockReportsAction(formData: FormData): Promise<void> {
  await requireUser();

  const report = fieldText(formData, "report");
  const parsed = reportUnlockSchema.safeParse({
    passcode: fieldText(formData, "passcode"),
    next: fieldText(formData, "next") || undefined,
  });
  const next =
    parsed.success && parsed.data.next ? parsed.data.next : DEFAULT_REPORT_PATH;
  const backTo = (error: UnlockError) => {
    const query = new URLSearchParams({ report, next, error });
    return `${REPORTS_UNLOCK_PATH}?${query.toString()}`;
  };

  if (!isReportKey(report)) redirect(backTo("report"));
  if (!reportsPasscodeConfigured()) redirect(backTo("unset"));
  if (!parsed.success || !passcodeMatches(parsed.data.passcode)) {
    logger.warn("Reports unlock refused", { report });
    redirect(backTo("wrong"));
  }

  await unlockReports(report);
  redirect(next);
}
