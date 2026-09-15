import { getProductById } from "@/data/products";
import { logger } from "@/lib/logger";
import { CONTACT, SITE } from "@/lib/site";
import type { InquiryPayload } from "@/lib/validations/inquiry";

export interface ResolvedLine {
  productId: string;
  name: string;
  range: string;
  quantity: number;
  unit: string;
}

export interface InquiryResult {
  reference: string;
  lineCount: number;
  /** False when notification delivery failed but the inquiry was accepted. */
  notified: boolean;
}

/** Human-readable reference the customer can quote on the phone. */
function buildReference(): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `OSP-${stamp}-${random}`;
}

/** Resolve request lines against the catalogue, dropping anything unknown. */
function resolveLines(payload: InquiryPayload): ResolvedLine[] {
  return payload.lines.flatMap<ResolvedLine>((line) => {
    const product = getProductById(line.productId);
    if (!product) return [];
    return [
      {
        productId: product.id,
        name: product.name,
        range: product.range,
        quantity: line.quantity,
        unit: product.unit,
      },
    ];
  });
}

/**
 * Strip anything that could break out of a header or an HTML body.
 * Everything a visitor typed passes through here before it reaches an email.
 */
function clean(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildEmailHtml(
  payload: InquiryPayload,
  lines: ResolvedLine[],
  reference: string,
): string {
  const rows = lines
    .map(
      (line) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e6ebf2">
            ${escapeHtml(line.name)}<br>
            <span style="color:#6e809e;font-size:12px">${escapeHtml(line.range)}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e6ebf2;text-align:right">
            ${line.quantity} ${escapeHtml(line.unit)}
          </td>
        </tr>`,
    )
    .join("");

  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;color:#16294a;max-width:640px">
    <p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#2563eb;margin:0">
      New trade inquiry
    </p>
    <h1 style="font-size:22px;margin:8px 0 4px">${escapeHtml(clean(payload.businessName))}</h1>
    <p style="margin:0 0 20px;color:#6e809e;font-size:13px">Reference ${reference}</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
      <tr><td style="padding:4px 0;color:#6e809e;width:140px">Contact</td><td>${escapeHtml(clean(payload.contactName))}</td></tr>
      <tr><td style="padding:4px 0;color:#6e809e">Business type</td><td>${escapeHtml(payload.businessType)}</td></tr>
      <tr><td style="padding:4px 0;color:#6e809e">Email</td><td>${escapeHtml(payload.email)}</td></tr>
      <tr><td style="padding:4px 0;color:#6e809e">Phone</td><td>${escapeHtml(clean(payload.phone))}</td></tr>
      <tr><td style="padding:4px 0;color:#6e809e">City</td><td>${escapeHtml(clean(payload.city))}</td></tr>
    </table>

    ${
      lines.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:14px">
             <thead>
               <tr style="background:#f1f4f8">
                 <th align="left" style="padding:8px 12px">Line</th>
                 <th align="right" style="padding:8px 12px">Qty requested</th>
               </tr>
             </thead>
             <tbody>${rows}</tbody>
           </table>`
        : `<p style="color:#6e809e">No catalogue lines attached — general inquiry.</p>`
    }

    ${
      payload.notes
        ? `<h2 style="font-size:14px;margin:24px 0 6px">Notes</h2>
           <p style="white-space:pre-wrap;font-size:14px;line-height:1.6">${escapeHtml(clean(payload.notes))}</p>`
        : ""
    }

    <p style="margin-top:28px;color:#6e809e;font-size:12px">
      Sent from ${SITE.url}. Quantities are what the customer asked for —
      confirm pricing and order minimums on the quotation.
    </p>
  </div>`;
}

/**
 * Deliver the inquiry to the sales inbox.
 *
 * Resend is used when `RESEND_API_KEY` is configured; without it the inquiry
 * is logged and still accepted, so a missing key never loses a lead.
 */
async function notify(
  payload: InquiryPayload,
  lines: ResolvedLine[],
  reference: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFICATION_EMAIL ?? CONTACT.email;
  const from = process.env.INQUIRY_FROM_EMAIL;

  if (!apiKey || !from) {
    logger.warn("Inquiry notification skipped — email not configured", {
      reference,
      lineCount: lines.length,
    });
    return false;
  }

  // Never let a slow provider hold the request open.
  const timeout = AbortSignal.timeout(8000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: timeout,
      body: JSON.stringify({
        from,
        to,
        reply_to: payload.email,
        subject: `Trade inquiry ${reference} — ${clean(payload.businessName)}`,
        html: buildEmailHtml(payload, lines, reference),
      }),
    });

    if (!response.ok) {
      logger.error("Inquiry notification rejected by provider", {
        reference,
        status: response.status,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Inquiry notification failed", {
      reference,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

/**
 * Accept a validated trade inquiry.
 *
 * Notification failure does not fail the inquiry: the record is logged with
 * its reference so it can be recovered, and the visitor still gets a
 * confirmation rather than being asked to type everything again.
 */
export async function submitInquiry(
  payload: InquiryPayload,
): Promise<InquiryResult> {
  const reference = buildReference();
  const lines = resolveLines(payload);

  logger.info("Trade inquiry received", {
    reference,
    businessType: payload.businessType,
    city: clean(payload.city),
    lineCount: lines.length,
  });

  const notified = await notify(payload, lines, reference);

  return { reference, lineCount: lines.length, notified };
}
