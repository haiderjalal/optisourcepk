import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReportKey } from "@/lib/validations/shop/reportUnlock";

/**
 * The passcode that locks the reports: Monthly sales, Ledger, RX lab report and
 * Stock report, and their PDFs.
 *
 * The passcode is read from REPORTS_PASSCODE on the server and never reaches the
 * browser. Only one report is open at a time: opening a report unlocks it and
 * locks the one before, so switching report tabs asks for the passcode again.
 * The unlock lasts 8 hours at most, and changing the passcode locks every browser.
 * With REPORTS_PASSCODE unset, the reports stay locked.
 *
 * A four-digit passcode is a light gate on top of the owner's login, not a
 * defence against someone who is determined to guess it.
 */

const COOKIE_NAME = "shop_reports_unlocked";
const UNLOCK_HOURS = 8;

export const REPORTS_UNLOCK_PATH = "/shop/reports/unlock";

function configuredPasscode(): string | null {
  return process.env.REPORTS_PASSCODE || null;
}

export function reportsPasscodeConfigured(): boolean {
  return configuredPasscode() !== null;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Compared in constant time, so a wrong guess reveals nothing about the passcode. */
export function passcodeMatches(entered: string): boolean {
  const expected = configuredPasscode();
  if (!expected) return false;
  return timingSafeEqual(digest(entered), digest(expected));
}

/** The signature covers the report too, so an unlock for one report cannot be reused for another. */
function sign(passcode: string, report: ReportKey, expiresAt: number): string {
  return createHmac("sha256", passcode)
    .update(`${report}.${expiresAt}`)
    .digest("hex");
}

/** Opens one report for this browser, in place of any other. Call only after `passcodeMatches` succeeds. */
export async function unlockReports(report: ReportKey): Promise<void> {
  const passcode = configuredPasscode();
  if (!passcode) throw new Error("REPORTS_PASSCODE is not set.");

  const expiresAt = Date.now() + UNLOCK_HOURS * 60 * 60 * 1000;
  const store = await cookies();
  store.set(
    COOKIE_NAME,
    `${report}.${expiresAt}.${sign(passcode, report, expiresAt)}`,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/shop",
      expires: new Date(expiresAt),
    },
  );
}

/**
 * Whether `report` is the one open in this browser, unlocked recently under the
 * passcode that is set now.
 */
export async function reportsUnlocked(report: ReportKey): Promise<boolean> {
  const passcode = configuredPasscode();
  if (!passcode) return false;

  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return false;

  const [open, expiry, signature] = value.split(".");
  const expiresAt = Number(expiry);
  if (
    open !== report ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    !signature
  ) {
    return false;
  }

  const expected = sign(passcode, report, expiresAt);
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}

/** Sends a locked browser to the passcode page, which then returns it to `next`. */
export async function requireReportsUnlocked(
  report: ReportKey,
  next: string,
): Promise<void> {
  if (await reportsUnlocked(report)) return;
  const query = new URLSearchParams({ report, next });
  redirect(`${REPORTS_UNLOCK_PATH}?${query.toString()}`);
}

/** What a PDF route returns to a browser that has not unlocked the report. */
export function reportsLockedResponse(): Response {
  return new Response(
    "The report is locked. Unlock it in the back office first.",
    { status: 403 },
  );
}
