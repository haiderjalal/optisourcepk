import { logger } from "@/lib/logger";
import { isValidSignature, safeEqual } from "@/lib/whatsapp/signature";

/**
 * WhatsApp Cloud API webhook.
 *
 * GET  — Meta's subscription handshake. Echo `hub.challenge` when the verify
 *        token matches, otherwise refuse.
 * POST — a signed event batch. Validate the signature against the raw body,
 *        record it, acknowledge immediately.
 *
 * Meta retries a non-200 for seven days and drops it after that, so this
 * handler acknowledges as soon as the payload is captured and never fails on
 * an event shape it does not recognise. There is no API for fetching
 * historical webhooks — anything not captured here is gone.
 */

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (!expected) {
    logger.error("WhatsApp webhook verification attempted with no token set");
    return new Response("Not configured", { status: 500 });
  }

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Bad request", { status: 400 });
  }

  if (!safeEqual(token, expected)) {
    logger.warn("WhatsApp webhook verification rejected: token mismatch");
    return new Response("Forbidden", { status: 403 });
  }

  logger.info("WhatsApp webhook verified");

  // Meta requires the challenge echoed back as plain text, nothing else.
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();

  if (!appSecret) {
    logger.error("WhatsApp webhook received with no app secret configured");
    return new Response("Not configured", { status: 500 });
  }

  // The exact bytes Meta signed. Parsing first and re-serialising would
  // change whitespace and key order, and the hash would never match.
  const rawBody = await request.text();

  const valid = isValidSignature({
    rawBody,
    header: request.headers.get("x-hub-signature-256"),
    appSecret,
  });

  if (!valid) {
    logger.warn("WhatsApp webhook rejected: bad signature", {
      bytes: rawBody.length,
    });
    return new Response("Forbidden", { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Signed but unparseable. Acknowledge anyway: retrying will not fix it,
    // and a stuck event blocks the queue behind it for a week.
    logger.error("WhatsApp webhook payload was not valid JSON");
    return new Response("OK", { status: 200 });
  }

  try {
    record(payload);
  } catch (error) {
    // Never let our own handling turn into a retry storm.
    logger.error("WhatsApp webhook handling failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  return new Response("OK", { status: 200 });
}

/**
 * Capture what arrived.
 *
 * Logged as structured JSON for now so nothing is lost before the events
 * table exists. Message ids are logged so duplicates can be spotted: Meta
 * retries on failure and does not guarantee exactly-once delivery.
 */
function record(payload: unknown): void {
  const entries = readEntries(payload);

  if (entries.length === 0) {
    logger.info("WhatsApp webhook event ignored", { kind: "no messages" });
    return;
  }

  for (const entry of entries) {
    logger.info("WhatsApp message received", {
      messageId: entry.id,
      from: entry.from,
      groupId: entry.groupId,
      type: entry.type,
      timestamp: entry.timestamp,
      // Order text is the whole point of this endpoint, so it is kept.
      text: entry.text,
    });
  }
}

interface InboundMessage {
  id?: string;
  from?: string;
  /** Present when the message was sent in a group rather than a 1:1 chat. */
  groupId?: string;
  type?: string;
  timestamp?: string;
  text?: string;
}

/**
 * Pull the messages out of Meta's envelope.
 *
 * Defensive throughout: a batch can carry status updates, errors, or field
 * types we do not subscribe to, and none of those should throw.
 */
function readEntries(payload: unknown): InboundMessage[] {
  if (typeof payload !== "object" || payload === null) return [];

  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return [];

  const out: InboundMessage[] = [];

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;

      for (const message of messages) {
        const m = message as Record<string, unknown>;
        const body = (m.text as { body?: string } | undefined)?.body;

        out.push({
          id: typeof m.id === "string" ? m.id : undefined,
          from: typeof m.from === "string" ? m.from : undefined,
          groupId: typeof m.group_id === "string" ? m.group_id : undefined,
          type: typeof m.type === "string" ? m.type : undefined,
          timestamp: typeof m.timestamp === "string" ? m.timestamp : undefined,
          text: typeof body === "string" ? body : undefined,
        });
      }
    }
  }

  return out;
}
