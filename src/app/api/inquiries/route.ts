import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { inquirySchema } from "@/lib/validations/inquiry";
import { submitInquiry, type InquiryResult } from "@/services/inquiry.service";
import type { ApiResponse } from "@/types/api";

type Body = ApiResponse<Pick<InquiryResult, "reference">>;

/**
 * POST /api/inquiries — accept a trade inquiry.
 *
 * The handler stays thin on purpose: parse, rate limit, validate, hand to the
 * service. Every business decision lives in `inquiry.service.ts`.
 */
export async function POST(request: Request): Promise<NextResponse<Body>> {
  const limit = rateLimit(`inquiry:${clientKey(request)}`);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        message:
          "That is a lot of inquiries in a short time. Please try again shortly, or call us directly.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "We could not read that request." },
      { status: 400 },
    );
  }

  const parsed = inquirySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Please check the highlighted fields and try again.",
        errors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      },
      { status: 422 },
    );
  }

  // Honeypot: accept silently so the bot learns nothing from the response.
  if (parsed.data.company) {
    logger.warn("Inquiry rejected by honeypot");
    return NextResponse.json({
      success: true,
      message: "Thank you — your inquiry has been received.",
    });
  }

  try {
    const result = await submitInquiry(parsed.data);

    return NextResponse.json({
      success: true,
      message: result.notified
        ? "Your inquiry is with our trade desk. We will be in touch within one working day."
        : "Your inquiry has been recorded. If you do not hear from us within one working day, please call us directly.",
      data: { reference: result.reference },
    });
  } catch (error) {
    logger.error("Inquiry submission failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      {
        success: false,
        message:
          "We could not submit your inquiry just now. Please try again, or reach us on WhatsApp.",
      },
      { status: 500 },
    );
  }
}
