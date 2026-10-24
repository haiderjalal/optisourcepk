import { ReportPdfActions } from "@/features/shop/pdf/ReportPdfActions";
import { pdfFileName } from "@/features/shop/pdf/pdfResponse";
import { formatDate } from "@/lib/format";

/**
 * Print, share or download the RX lab report for its date range. The actions
 * themselves are shared with every other report.
 */
export function RxLabReportActions({ from, to }: { from: string; to: string }) {
  return (
    <ReportPdfActions
      pdfPath={`/shop/rx-lab-report/pdf?${new URLSearchParams({ from, to })}`}
      fileName={pdfFileName("RX-Lab-Report", `${from} to ${to}`)}
      shareText={`OptiSource PK — RX lab report, ${formatDate(from)} to ${formatDate(to)}`}
      printFrameId="rx-lab-report-print"
    />
  );
}
