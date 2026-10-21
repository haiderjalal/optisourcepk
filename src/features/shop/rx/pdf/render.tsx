import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { loadBrandLogo } from "@/features/shop/pdf/brandLogo";
import { RxLabReportDocument } from "./RxLabReportDocument";
import type { RxLabPdfModel } from "./model";

/** Render the RX lab report to PDF bytes — the same bytes download, print and share. */
export async function renderRxLabReportPdf(
  model: RxLabPdfModel,
): Promise<Buffer> {
  const logo = await loadBrandLogo();
  return renderToBuffer(
    <RxLabReportDocument model={model} logo={logo ?? undefined} />,
  );
}
