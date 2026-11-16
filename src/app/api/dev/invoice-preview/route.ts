import { SAMPLE_INVOICE } from "@/features/shop/invoice/pdf/sample";
import { renderInvoicePdf } from "@/features/shop/invoice/pdf/render";

export const dynamic = "force-dynamic";

/**
 * GET /api/dev/invoice-preview — the invoice layout, rendered from the
 * reference figures in `sample.ts`.
 *
 * A development tool: it lets the document be worked on and held against the
 * original without a database, a login or a real order. It is served only by
 * the local dev server (`NODE_ENV === "development"`). Every other environment,
 * including Vercel preview and production builds, gets a plain 404, so there is
 * no route to render a PDF without the back-office session. It reads nothing —
 * the figures are fixed in source — so it can never leak a real invoice.
 *
 * It sits under /api rather than /shop deliberately, so it is outside the
 * back-office session gate and needs no credentials to look at.
 */
export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const pdf = await renderInvoicePdf(SAMPLE_INVOICE);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="invoice-layout-preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
