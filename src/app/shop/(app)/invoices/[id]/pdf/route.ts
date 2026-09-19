import { requireUser } from "@/server/shop/dal";
import { getOrder } from "@/services/shop/invoice.service";
import { buildInvoicePdfModel } from "@/features/shop/invoice/pdf/model";
import {
  invoiceFileName,
  renderInvoicePdf,
} from "@/features/shop/invoice/pdf/render";

/**
 * GET /shop/invoices/[id]/pdf — the invoice as a PDF.
 *
 * `?download` forces a save dialog; without it the browser previews inline.
 * Route Handler GET is dynamic by default in Next 16, and `requireUser()`
 * re-checks the session because a proxy matcher is not a guarantee.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/shop/invoices/[id]/pdf">,
): Promise<Response> {
  await requireUser();

  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  const model = buildInvoicePdfModel(order);
  const pdf = await renderInvoicePdf(model);

  const download = new URL(request.url).searchParams.has("download");
  const disposition = download ? "attachment" : "inline";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${invoiceFileName(model.invoiceNo)}"`,
      // An invoice is private and can change while it is still a draft.
      "Cache-Control": "private, no-store",
    },
  });
}
