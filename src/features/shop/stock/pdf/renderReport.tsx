import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { loadBrandLogo } from "@/features/shop/pdf/brandLogo";
import { StockReportDocument } from "./StockReportDocument";
import type { StockReportPdfModel } from "./model";

/** Render the stock report to PDF bytes — the same bytes download, print and share. */
export async function renderStockReportPdf(
  model: StockReportPdfModel,
): Promise<Buffer> {
  const logo = await loadBrandLogo();
  return renderToBuffer(
    <StockReportDocument model={model} logo={logo ?? undefined} />,
  );
}
