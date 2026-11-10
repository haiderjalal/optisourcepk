import { PDF_COMPANY } from "@/features/shop/pdf/company";
import {
  amount,
  partyLines,
  power,
  stamp,
  type InvoicePdfModel,
} from "@/features/shop/invoice/pdf/model";
import { returnLabel } from "@/features/shop/returns/label";
import type { ReturnDocument } from "@/services/shop/return.service";

/**
 * What the sales return document draws: the invoice's own layout, with the lines
 * and amounts printed as a credit, and the invoice it reverses named underneath
 * the title. The figures come from the return's own lines, so the document shows
 * what was credited.
 */

/** A credit is printed with a minus sign; a zero stays plain. */
function credit(value: number): string {
  return value === 0 ? amount(0) : `-${amount(value)}`;
}

export function buildReturnPdfModel({
  ret,
  lines,
  invoice,
}: ReturnDocument): InvoicePdfModel {
  const shop = invoice.bill_to_shop ?? "—";
  const billLines = partyLines(
    invoice.bill_to_name,
    invoice.bill_to_address,
    "PAKISTAN",
    invoice.bill_to_ntn ? `NTN ${invoice.bill_to_ntn}` : null,
    invoice.bill_to_strn ? `STRN ${invoice.bill_to_strn}` : null,
  );

  // A line's gross is its price times the quantity returned; its discount is what
  // the line was given. The amount credited is what remains.
  const grossOf = (qty: number, price: number) => price * qty;
  const grossTotal = lines.reduce(
    (sum, line) => sum + grossOf(line.quantity, line.unit_price),
    0,
  );
  const discountTotal = lines.reduce(
    (sum, line) => sum + grossOf(line.quantity, line.unit_price) - line.amount,
    0,
  );
  const netTotal = lines.reduce((sum, line) => sum + line.amount, 0);

  return {
    company: PDF_COMPANY,
    title: "SALES RETURN",
    documentNo: returnLabel(ret.return_no),
    reference: invoice.invoice_no
      ? `Against invoice ${invoice.invoice_no}`
      : null,
    issuedAt: stamp(ret.returned_at),
    courier: "",
    trackingNo: "",
    priority: "",
    orderBy: {
      name: invoice.order_by_name ?? shop,
      lines: invoice.order_by_name ? [] : billLines,
    },
    deliverTo: { name: shop, lines: billLines },
    invoiceTo: { name: shop, lines: billLines },
    lines: lines.map((line, index) => {
      const gross = grossOf(line.quantity, line.unit_price);
      return {
        no: index + 1,
        orderRef: line.orderRef ?? "",
        product: line.product_name,
        sph: power(line.sph),
        cyl: power(line.cyl),
        ax: line.ax === null ? "" : `+${line.ax}`,
        add: power(line.add_power),
        price: credit(line.unit_price),
        discount: credit(gross - line.amount),
        qty: String(line.quantity),
        total: credit(line.amount),
      };
    }),
    totals: [
      { label: "Invoice Amount", value: credit(grossTotal) },
      { label: "Discount Amount", value: credit(discountTotal) },
      { label: "Net Amount", value: credit(netTotal), strong: true },
    ],
    orderQty: String(lines.reduce((sum, line) => sum + line.quantity, 0)),
    lensQty: String(
      lines
        .filter((line) => line.sph !== null)
        .reduce((sum, line) => sum + line.quantity, 0),
    ),
    account: [],
    voided: false,
  };
}
