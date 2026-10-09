import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { loadBrandLogo } from "@/features/shop/pdf/brandLogo";
import { InvoiceBundleDocument, InvoiceDocument } from "./InvoiceDocument";
import type { InvoicePdfModel } from "./model";

/**
 * Render invoices to PDF buffers.
 *
 * A Buffer rather than a stream or a print dialog, because the same bytes have
 * to serve the download response today and a WhatsApp document upload later.
 */

export async function renderInvoicePdf(
  model: InvoicePdfModel,
): Promise<Buffer> {
  const logo = await loadBrandLogo();
  return renderToBuffer(
    <InvoiceDocument model={model} logo={logo ?? undefined} />,
  );
}

/** Several invoices in one file, in the order given, each on its own page(s). */
export async function renderInvoiceBundlePdf(
  models: InvoicePdfModel[],
  title: string,
): Promise<Buffer> {
  const logo = await loadBrandLogo();
  return renderToBuffer(
    <InvoiceBundleDocument
      models={models}
      title={title}
      logo={logo ?? undefined}
    />,
  );
}

/** `OptiSource-Invoice-1042.pdf` — safe on every filesystem. */
export function invoiceFileName(invoiceNo: string): string {
  return `OptiSource-Invoice-${invoiceNo.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}
