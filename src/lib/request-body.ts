/**
 * Read a JSON request body with a size ceiling, before anything is parsed.
 *
 * Public endpoints receive untrusted bytes. Checking the declared length first
 * rejects an oversized body without buffering it; the measured length check
 * covers requests that omit or understate the header.
 */

export type JsonBodyResult =
  { ok: true; value: unknown } | { ok: false; status: 400 | 413 | 415 };

export type RawBodyResult =
  { ok: true; text: string } | { ok: false; status: 413 };

/**
 * Read a body as text, giving up once it passes `maxBytes`.
 *
 * For endpoints that must see the exact bytes (a signed webhook) and so cannot
 * use `readJsonBody`. The stream is cut off as soon as the limit is crossed, so
 * a body that omits or understates its length is not buffered whole.
 */
export async function readRawBody(
  request: Request,
  maxBytes: number,
): Promise<RawBodyResult> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, status: 413 };

  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(bytes) };
}

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
