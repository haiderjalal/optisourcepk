import { requireUser } from "@/server/shop/dal";
import { getCustomer } from "@/services/shop/customer.service";
import { getBalance, getStatement } from "@/services/shop/ledger.service";
import { buildLedgerPdfModel } from "@/features/shop/ledger/pdf/model";
import { renderLedgerPdf } from "@/features/shop/ledger/pdf/render";
import {
  pdfFileName,
  pdfResponse,
  wantsDownload,
} from "@/features/shop/pdf/pdfResponse";
import { todayInKarachi } from "@/lib/format";

/**
 * GET /shop/customers/[id]/statement/pdf — the customer ledger as a PDF.
 *
 * The same lines and balance as the statement screen, so the two agree.
 * `?download` forces a save dialog; without it the browser previews inline.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/shop/customers/[id]/statement/pdf">,
): Promise<Response> {
  await requireUser();

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) {
    return new Response("Not found", { status: 404 });
  }

  const [lines, balance] = await Promise.all([
    getStatement(id),
    getBalance(id),
  ]);
  const pdf = await renderLedgerPdf(
    buildLedgerPdfModel({ customer, lines, balance, asOf: todayInKarachi() }),
  );

  return pdfResponse(
    pdf,
    pdfFileName("Ledger", customer.shop_name),
    wantsDownload(request),
  );
}
