import { requireUser } from "@/server/shop/dal";
import { getCustomer } from "@/services/shop/customer.service";
import { listIssuedInvoicesForCustomer } from "@/services/shop/invoice.service";
import { listReturns } from "@/services/shop/return.service";
import { buildInvoiceBundleModels } from "@/features/shop/invoice/pdf/model";
import { renderInvoiceBundlePdf } from "@/features/shop/invoice/pdf/render";
import {
  pdfFileName,
  pdfResponse,
  wantsDownload,
} from "@/features/shop/pdf/pdfResponse";

/** Well past any one shop's returns, so none is left out of its invoices. */
const RETURNS_LIMIT = 500;

/**
 * GET /shop/customers/[id]/invoices/pdf — every issued invoice for one shop,
 * oldest first, in a single PDF.
 *
 * Voided invoices stay in, marked VOID, so the file matches the shop's record.
 * `?download` forces a save dialog; without it the browser previews inline.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/shop/customers/[id]/invoices/pdf">,
): Promise<Response> {
  await requireUser();

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) {
    return new Response("Not found", { status: 404 });
  }

  const [invoices, returns] = await Promise.all([
    listIssuedInvoicesForCustomer(customer),
    listReturns({ customerId: id, limit: RETURNS_LIMIT }),
  ]);
  if (invoices.length === 0) {
    return new Response("This shop has no issued invoices yet.", {
      status: 404,
    });
  }

  const pdf = await renderInvoiceBundlePdf(
    buildInvoiceBundleModels(invoices, returns),
    `Invoices — ${customer.shop_name}`,
  );

  return pdfResponse(
    pdf,
    pdfFileName("Invoices", customer.shop_name),
    wantsDownload(request),
  );
}
