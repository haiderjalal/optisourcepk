import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { loadBrandLogo } from "@/features/shop/pdf/brandLogo";
import { LedgerDocument } from "./LedgerDocument";
import type { LedgerPdfModel } from "./model";

/** Render the customer ledger to PDF bytes — the same bytes download and share. */
export async function renderLedgerPdf(model: LedgerPdfModel): Promise<Buffer> {
  const logo = await loadBrandLogo();
  return renderToBuffer(
    <LedgerDocument model={model} logo={logo ?? undefined} />,
  );
}
