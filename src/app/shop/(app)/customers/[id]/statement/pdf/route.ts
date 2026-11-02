import { requireUser } from "@/server/shop/dal";
import { getCustomer } from "@/services/shop/customer.service";
import { getBalance, getStatement } from "@/services/shop/ledger.service";
import { buildLedgerPdfModel } from "@/features/shop/ledger/pdf/model";
import {
  isReversedPeriod,
  readStatementDay,
  statementSlice,
  type StatementPeriod,
} from "@/features/shop/ledger/statementRange";
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
 * The same lines and balance as the statement screen, so the two agree. `from`
 * and `to` (YYYY-MM-DD) limit it to a period, as the screen does.
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

  const url = new URL(request.url);
  const requested: StatementPeriod = {
    from: readStatementDay(url.searchParams.get("from")),
    to: readStatementDay(url.searchParams.get("to")),
  };
  // A reversed period is shown whole, as the screen does.
  const period = isReversedPeriod(requested)
    ? { from: null, to: null }
    : requested;

  const [lines, balance] = await Promise.all([
    getStatement(id),
    getBalance(id),
  ]);
  // Same fallback as the statement screen: no balance row yet means the
  // opening balance is all there is.
  const owed = balance?.balance ?? customer.opening_balance;
  const slice = statementSlice(lines, period, owed);
  const pdf = await renderLedgerPdf(
    buildLedgerPdfModel({
      customer,
      lines: slice.lines,
      balance,
      period,
      broughtForward: slice.broughtForward,
      closing: slice.closing,
      asOf: todayInKarachi(),
    }),
  );

  return pdfResponse(
    pdf,
    pdfFileName("Ledger", customer.shop_name),
    wantsDownload(request),
  );
}
