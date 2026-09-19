import { notFound } from "next/navigation";
import { SAMPLE_INVOICE } from "@/features/shop/invoice/pdf/sample";
import { renderInvoicePdf } from "@/features/shop/invoice/pdf/render";

/**
 * GET /api/dev/invoice-preview — the invoice layout, rendered from the
 * reference figures in `sample.ts`.
 *
 * A development tool: it lets the document be worked on and held against the
 * original without a database, a login or a real order. It returns 404 in
 * production, and it reads nothing — the figures are fixed in source — so it
 * can never leak a real invoice.
 *
 * It sits under /api rather than /shop deliberately, so it is outside the
 * back-office session gate and needs no credentials to look at.
 */
export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === "production") notFound();

  const pdf = await renderInvoicePdf(SAMPLE_INVOICE);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="invoice-layout-preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
