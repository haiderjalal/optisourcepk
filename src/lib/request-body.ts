/**
 * Read a JSON request body with a size ceiling, before anything is parsed.
 *
 * Public endpoints receive untrusted bytes. Checking the declared length first
 * rejects an oversized body without buffering it; the measured length check
 * covers requests that omit or understate the header.
 */

export type JsonBodyResult =
  { ok: true; value: unknown } | { ok: false; status: 400 | 413 | 415 };

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { ok: false, status: 415 };
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, status: 413 };

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, status: 413 };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
