/**
 * Self-check for the webhook signature logic.
 *
 *   node src/lib/whatsapp/signature.check.mjs
 *
 * Deliberately dependency-free and a copy of the implementation's shape
 * rather than an import: the source is TypeScript, and a check that needs a
 * build step is a check nobody runs. If `signature.ts` changes, change this
 * too — it exists to catch the mistakes that make a webhook silently reject
 * everything, or silently accept anything.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import assert from "node:assert/strict";

function safeEqual(a, b) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isValidSignature({ rawBody, header, appSecret }) {
  if (!header || !appSecret) return false;
  if (!header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  return safeEqual(header.slice("sha256=".length), expected);
}

const SECRET = "test-app-secret";
const BODY = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ id: "1", changes: [{ value: { messages: [{ id: "wamid.X" }] } }] }],
});

const sign = (body, secret = SECRET) =>
  "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");

// A genuine Meta signature is accepted.
assert.equal(
  isValidSignature({ rawBody: BODY, header: sign(BODY), appSecret: SECRET }),
  true,
  "a correctly signed payload must be accepted",
);

// A tampered body is rejected, even by one character.
assert.equal(
  isValidSignature({
    rawBody: BODY.replace("wamid.X", "wamid.Y"),
    header: sign(BODY),
    appSecret: SECRET,
  }),
  false,
  "a modified body must be rejected",
);

// Someone else's secret is rejected.
assert.equal(
  isValidSignature({
    rawBody: BODY,
    header: sign(BODY, "wrong-secret"),
    appSecret: SECRET,
  }),
  false,
  "a signature from the wrong secret must be rejected",
);

// The regression that matters most: re-serialising the JSON changes the bytes,
// so the hash stops matching. This is why the handler must hash the raw body.
assert.equal(
  isValidSignature({
    rawBody: JSON.stringify(JSON.parse(BODY), null, 2),
    header: sign(BODY),
    appSecret: SECRET,
  }),
  false,
  "re-serialised JSON must not validate — hash the raw body",
);

// Missing or malformed headers are rejected, not crashed on.
for (const header of [null, "", "abc", "sha1=deadbeef", "sha256="]) {
  assert.equal(
    isValidSignature({ rawBody: BODY, header, appSecret: SECRET }),
    false,
    `malformed header must be rejected: ${JSON.stringify(header)}`,
  );
}

// An empty app secret must never validate, whatever the header says.
assert.equal(
  isValidSignature({ rawBody: BODY, header: sign(BODY), appSecret: "" }),
  false,
  "an unset app secret must reject everything",
);

// safeEqual compares length first, so unequal lengths must not throw.
assert.equal(safeEqual("short", "considerably-longer"), false);
assert.equal(safeEqual("same", "same"), true);

console.log("signature checks passed");
