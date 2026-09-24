import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import {
  StockSheetDocument,
  type StockSheetPdfModel,
} from "./StockSheetDocument";

/** Render a stock sheet to PDF bytes — the same bytes print and share. */
export function renderStockSheetPdf(
  model: StockSheetPdfModel,
): Promise<Buffer> {
  return renderToBuffer(<StockSheetDocument model={model} />);
}

/** `OptiSource-Stock-HOYA-HI-1-60.pdf` — safe on every filesystem. */
export function stockSheetFileName(productName: string): string {
  const slug = productName
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `OptiSource-Stock-${slug || "sheet"}.pdf`;
}
