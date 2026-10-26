import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * The passcode that locks the reports: Monthly sales, Ledger, RX lab report and
 * Stock report, and their PDFs.
 *
 * The passcode is read from REPORTS_PASSCODE on the server and never reaches the
 * browser. A correct entry sets a cookie signed with the passcode itself, so
 * changing the passcode locks every browser again. With REPORTS_PASSCODE unset,
 * the reports stay locked.
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

function sign(passcode: string, expiresAt: number): string {
  return createHmac("sha256", passcode).update(String(expiresAt)).digest("hex");
}

/** Opens the reports for this browser. Call only after `passcodeMatches` succeeds. */
export async function unlockReports(): Promise<void> {
  const passcode = configuredPasscode();
  if (!passcode) throw new Error("REPORTS_PASSCODE is not set.");

  const expiresAt = Date.now() + UNLOCK_HOURS * 60 * 60 * 1000;
  const store = await cookies();
  store.set(COOKIE_NAME, `${expiresAt}.${sign(passcode, expiresAt)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/shop",
    expires: new Date(expiresAt),
  });
}

/**
 * Whether this browser unlocked the reports recently, under the passcode that is
 * set now. Changing the passcode invalidates every unlock.
 */
export async function reportsUnlocked(): Promise<boolean> {
  const passcode = configuredPasscode();
  if (!passcode) return false;

  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return false;

  const [expiry, signature] = value.split(".");
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) {
    return false;
  }

  const expected = sign(passcode, expiresAt);
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}

/** Sends a locked browser to the passcode page, which then returns it to `next`. */
export async function requireReportsUnlocked(next: string): Promise<void> {
  if (await reportsUnlocked()) return;
  redirect(`${REPORTS_UNLOCK_PATH}?next=${encodeURIComponent(next)}`);
}

/** What a PDF route returns to a browser that has not unlocked the reports. */
export function reportsLockedResponse(): Response {
  return new Response(
    "The reports are locked. Unlock them in the back office first.",
    { status: 403 },
  );
}
