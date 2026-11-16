"use server";

import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import { isRateLimited, rateLimit } from "@/lib/rateLimit";
import {
  isReportKey,
  reportUnlockSchema,
} from "@/lib/validations/shop/reportUnlock";
import { requireUser } from "@/server/shop/dal";
import {
  lockReports,
  passcodeMatches,
  REPORTS_UNLOCK_PATH,
  reportsPasscodeConfigured,
  unlockReports,
} from "@/server/shop/reportLock";

/** Where a correct passcode lands when the page was not told where to go. */
const DEFAULT_REPORT_PATH = "/shop/sales";

/**
 * The passcode is four digits, so an unthrottled guess needs about ten thousand
 * tries. Six wrong guesses per signed-in user in 15 minutes makes that take days.
 */
const UNLOCK_FAILURE_LIMIT = 6;
const UNLOCK_FAILURE_WINDOW_MS = 15 * 60 * 1000;

type UnlockError = "report" | "unset" | "wrong" | "throttled";

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
  const { user } = await requireUser();

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

  // Only wrong guesses count against the limit. Switching reports asks for the
  // passcode again each time, and that must not lock the owner out.
  const throttleKey = `reports-unlock:${user.id}`;
  const throttleOptions = {
    limit: UNLOCK_FAILURE_LIMIT,
    windowMs: UNLOCK_FAILURE_WINDOW_MS,
  };
  if (!isRateLimited(throttleKey, throttleOptions).allowed) {
    logger.warn("Reports unlock throttled", { report });
    redirect(backTo("throttled"));
  }

  if (!parsed.success || !passcodeMatches(parsed.data.passcode)) {
    rateLimit(throttleKey, throttleOptions);
    logger.warn("Reports unlock refused", { report });
    redirect(backTo("wrong"));
  }

  await unlockReports(report);
  redirect(next);
}

/** Locks the reports again once this browser has left them for another page. */
export async function lockReportsAction(): Promise<void> {
  await requireUser();
  await lockReports();
}
