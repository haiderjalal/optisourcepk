import { requireUser } from "@/server/shop/dal";
import { getProductStock } from "@/services/shop/stock.service";
import { CONTACT, SITE } from "@/lib/site";
import { formatDateTime } from "@/lib/format";
import {
  renderStockSheetPdf,
  stockSheetFileName,
} from "@/features/shop/stock/pdf/render";

/**
 * GET /shop/stock/[productId]/pdf — one lens product's stock sheet as a PDF.
 *
 * `?download` forces a save dialog; without it the browser previews inline.
 * `requireUser()` re-checks the session because a proxy matcher is not a
 * guarantee.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/shop/stock/[productId]/pdf">,
): Promise<Response> {
  await requireUser();

  const { productId } = await params;
  const stock = await getProductStock(productId);

  if (!stock?.sheet) {
    return new Response("Not found", { status: 404 });
  }

  const pdf = await renderStockSheetPdf({
    companyName: SITE.name,
    addressLine: `${CONTACT.address.line1}, ${CONTACT.address.city}.`,
    productName: stock.name,
    printedAt: formatDateTime(new Date().toISOString()),
    unit: stock.unit,
    sheet: stock.sheet,
  });

  const download = new URL(request.url).searchParams.has("download");
  const disposition = download ? "attachment" : "inline";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${stockSheetFileName(stock.name)}"`,
      // Stock changes with every sale; never serve a stale sheet.
      "Cache-Control": "private, no-store",
    },
  });
}
