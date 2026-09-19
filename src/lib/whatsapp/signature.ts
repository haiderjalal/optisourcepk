import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook authenticity checks.
 *
 * Kept free of `next/*` and of environment reads so both functions are pure
 * and can be exercised directly — see `signature.check.mjs`.
 */

/**
 * Constant-time string comparison.
 *
 * A plain `===` on a secret leaks its length and, byte by byte, its contents
 * through how long the comparison takes. Length is compared first because
 * `timingSafeEqual` throws on a mismatch — that much is already public from
 * the header itself.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verify the `X-Hub-Signature-256` header against the request body.
 *
 * `rawBody` must be the exact bytes Meta sent. Parsing the JSON and
 * re-serialising it changes whitespace and key order, and the hash will never
 * match — this is the usual reason a webhook silently rejects everything.
 */
export function isValidSignature({
  rawBody,
  header,
  appSecret,
}: {
  rawBody: string;
  header: string | null;
  appSecret: string;
}): boolean {
  if (!header || !appSecret) return false;
  if (!header.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  return safeEqual(header.slice("sha256=".length), expected);
}
