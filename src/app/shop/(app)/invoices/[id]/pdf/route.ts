import { requireUser } from "@/server/shop/dal";
import { getOrder } from "@/services/shop/invoice.service";
import { listReturns } from "@/services/shop/return.service";
import { summariseReturns } from "@/features/shop/returns/summary";
import { buildInvoicePdfModel } from "@/features/shop/invoice/pdf/model";
import {
  invoiceFileName,
  renderInvoicePdf,
} from "@/features/shop/invoice/pdf/render";

/**
 * GET /shop/invoices/[id]/pdf — the invoice as a PDF.
 *
 * `?download` forces a save dialog; without it the browser previews inline.
 * `?balance=0` leaves out the account summary — just this invoice.
 * Route Handler GET is dynamic by default in Next 16, and `requireUser()`
 * re-checks the session because a proxy matcher is not a guarantee.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/shop/invoices/[id]/pdf">,
): Promise<Response> {
  await requireUser();

  const { id } = await params;
  const [order, returns] = await Promise.all([
    getOrder(id),
    listReturns({ orderId: id, limit: 100 }),
  ]);

  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const model = buildInvoicePdfModel(order, {
    showBalance: url.searchParams.get("balance") !== "0",
    returns: summariseReturns(returns),
  });
  const pdf = await renderInvoicePdf(model);

  const download = url.searchParams.has("download");
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
