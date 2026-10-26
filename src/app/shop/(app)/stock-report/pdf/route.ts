import { logger } from "@/lib/logger";
import { resolveDateRange } from "@/lib/date-range";
import { todayInKarachi } from "@/lib/format";
import { requireUser } from "@/server/shop/dal";
import {
  reportsLockedResponse,
  reportsUnlocked,
} from "@/server/shop/reportLock";
import { loadStockReport } from "@/services/shop/stock-report.service";
import { buildStockReportPdfModel } from "@/features/shop/stock/pdf/model";
import { renderStockReportPdf } from "@/features/shop/stock/pdf/renderReport";
import {
  pdfFileName,
  pdfResponse,
  wantsDownload,
} from "@/features/shop/pdf/pdfResponse";

/**
 * GET /shop/stock-report/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD — the stock report for
 * a date range as a PDF. The same rows and totals as the report screen.
 *
 * `?download` forces a save dialog; without it the browser previews inline.
 * A missing or invalid range falls back to the current month, as the screen does.
 */
export async function GET(request: Request): Promise<Response> {
  await requireUser();
  if (!(await reportsUnlocked())) return reportsLockedResponse();

  const url = new URL(request.url);
  const range = resolveDateRange(
    {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    },
    todayInKarachi(),
  );
  const report = await loadStockReport(range);

  try {
    const pdf = await renderStockReportPdf(
      buildStockReportPdfModel({ report, ...range }),
    );

    return pdfResponse(
      pdf,
      pdfFileName("Stock-Report", `${range.from} to ${range.to}`),
      wantsDownload(request),
    );
  } catch (error) {
    // The browser only sees "error 500"; the log is where the cause lives.
    logger.error("Stock report PDF failed to render", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Could not build the stock report PDF.", {
      status: 500,
    });
  }
}
