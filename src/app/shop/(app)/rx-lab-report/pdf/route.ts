import { logger } from "@/lib/logger";
import { todayInKarachi } from "@/lib/format";
import { resolveDateRange } from "@/lib/date-range";
import { requireUser } from "@/server/shop/dal";
import {
  reportsLockedResponse,
  reportsUnlocked,
} from "@/server/shop/reportLock";
import { listRxLabRows } from "@/services/shop/rx-lab-report.service";
import { rxLabTotals } from "@/features/shop/rx/labReport";
import { buildRxLabPdfModel } from "@/features/shop/rx/pdf/model";
import { renderRxLabReportPdf } from "@/features/shop/rx/pdf/render";
import {
  pdfFileName,
  pdfResponse,
  wantsDownload,
} from "@/features/shop/pdf/pdfResponse";

/**
 * GET /shop/rx-lab-report/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD — the RX lab report
 * for a date range as a PDF. The same rows and totals as the report screen.
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
  const rows = await listRxLabRows(range);

  try {
    const pdf = await renderRxLabReportPdf(
      buildRxLabPdfModel({ rows, totals: rxLabTotals(rows), ...range }),
    );

    return pdfResponse(
      pdf,
      pdfFileName("RX-Lab-Report", `${range.from} to ${range.to}`),
      wantsDownload(request),
    );
  } catch (error) {
    // The browser only sees "error 500"; the log is where the cause lives.
    logger.error("RX lab report PDF failed to render", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Could not build the RX lab report PDF.", {
      status: 500,
    });
  }
}
