import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "./InvoiceDocument";
import type { InvoicePdfModel } from "./model";

/**
 * Render an invoice to a PDF buffer.
 *
 * A Buffer rather than a stream or a print dialog, because the same bytes have
 * to serve the download response today and a WhatsApp document upload later.
 */

const LOGO_PATH = path.join(process.cwd(), "public", "brand", "logo.png");

/**
 * The brand mark as a data URL, read once per process.
 *
 * A missing file must not stop an invoice going out, so failure is cached as
 * `null` and the document simply renders without the mark.
 */
let logoPromise: Promise<string | null> | undefined;

function loadLogo(): Promise<string | null> {
  logoPromise ??= readFile(LOGO_PATH)
    .then((file) => `data:image/png;base64,${file.toString("base64")}`)
    .catch(() => null);
  return logoPromise;
}

export async function renderInvoicePdf(
  model: InvoicePdfModel,
): Promise<Buffer> {
  const logo = await loadLogo();
  return renderToBuffer(
    <InvoiceDocument model={model} logo={logo ?? undefined} />,
  );
}

/** `OptiSource-Invoice-1042.pdf` — safe on every filesystem. */
export function invoiceFileName(invoiceNo: string): string {
  return `OptiSource-Invoice-${invoiceNo.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}
