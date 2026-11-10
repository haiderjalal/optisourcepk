import { logger } from "@/lib/logger";
import { requireUser } from "@/server/shop/dal";
import { getReturnDocument } from "@/services/shop/return.service";
import { renderInvoicePdf } from "@/features/shop/invoice/pdf/render";
import { buildReturnPdfModel } from "@/features/shop/returns/pdf/model";
import { returnLabel } from "@/features/shop/returns/label";
import {
  pdfFileName,
  pdfResponse,
  wantsDownload,
} from "@/features/shop/pdf/pdfResponse";

/**
 * GET /shop/returns/[id]/pdf — a sales return as a PDF, laid out like the invoice
 * and naming the invoice it reverses.
 *
 * `?download` forces a save dialog; without it the browser previews inline.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requireUser();

  const { id } = await params;
  const document = await getReturnDocument(id);
  if (!document) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const pdf = await renderInvoicePdf(buildReturnPdfModel(document));

    return pdfResponse(
      pdf,
      pdfFileName("Sales-Return", returnLabel(document.ret.return_no)),
      wantsDownload(request),
    );
  } catch (error) {
    // The browser only sees "error 500"; the log is where the cause lives.
    logger.error("Sales return PDF failed to render", {
      returnId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Could not build the sales return PDF.", {
      status: 500,
    });
  }
}
