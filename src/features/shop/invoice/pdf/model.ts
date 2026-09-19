import type { OrderWithLines } from "@/services/shop/invoice.service";
import { CONTACT, SITE } from "@/lib/site";

/**
 * What the invoice document draws.
 *
 * A plain serialisable object, deliberately: the renderer takes no database
 * types and does no lookups, so the same model can be built in a test, a route
 * handler or a future notification job.
 */

export interface InvoicePdfParty {
  name: string;
  lines: string[];
}

export interface InvoicePdfLine {
  no: number;
  orderRef: string;
  eye: string;
  product: string;
  sph: string;
  cyl: string;
  ax: string;
  add: string;
  price: string;
  discount: string;
  qty: string;
  total: string;
}

export interface InvoicePdfModel {
  company: { name: string; address: string; phone: string };
  invoiceNo: string;
  issuedAt: string;
  courier: string;
  trackingNo: string;
  priority: string;
  orderBy: InvoicePdfParty;
  deliverTo: InvoicePdfParty;
  invoiceTo: InvoicePdfParty;
  lines: InvoicePdfLine[];
  totals: { label: string; value: string; strong?: boolean }[];
  orderQty: string;
  lensQty: string;
  voided: boolean;
}

const AMOUNT = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function amount(value: number | null): string {
  return AMOUNT.format(value ?? 0);
}

/** Signed, two decimals — how an optician writes a dioptre. Blank for null. */
function power(value: number | null): string {
  if (value === null) return "";
  if (value === 0) return "0.00";
  return `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(2)}`;
}

function stamp(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  })
    .format(new Date(iso))
    .replace(",", "");
}

/** Drop empties so a party box never prints a blank line or a stray comma. */
function partyLines(...values: (string | null | undefined)[]): string[] {
  return values.map((v) => v?.trim()).filter((v): v is string => Boolean(v));
}

export function buildInvoicePdfModel(order: OrderWithLines): InvoicePdfModel {
  // Prefer the snapshot taken at issue; fall back to the live customer for a
  // draft preview, which has no snapshot yet.
  const billName = order.bill_to_shop ?? order.customer?.shop_name ?? "—";
  const billLines = partyLines(
    order.bill_to_name ?? order.customer?.customer_name,
    order.bill_to_address ?? order.customer?.address,
    order.customer?.area,
    "PAKISTAN",
    order.bill_to_ntn ? `NTN ${order.bill_to_ntn}` : null,
    order.bill_to_strn ? `STRN ${order.bill_to_strn}` : null,
  );

  const deliverName = order.deliver_to_name ?? billName;
  const deliverLines = order.deliver_to_name
    ? partyLines(
        order.deliver_to_address,
        order.deliver_to_area,
        "PAKISTAN",
        order.deliver_to_phone,
      )
    : billLines;

  const net = order.net_amount;

  return {
    company: {
      name: SITE.legalName,
      address: `${CONTACT.address.line1}, ${CONTACT.address.city}, ${CONTACT.address.country}`,
      phone: `${CONTACT.phone} · WhatsApp ${CONTACT.whatsapp}`,
    },
    invoiceNo: order.invoice_no ? String(order.invoice_no) : "DRAFT",
    issuedAt: stamp(order.issued_at ?? order.created_at),
    courier: order.courier_name ?? "",
    trackingNo: order.tracking_no ?? "",
    priority: order.priority === "urgent" ? "URGENT" : "",
    orderBy: {
      name: order.order_by_name ?? billName,
      lines: order.order_by_name ? [] : billLines,
    },
    deliverTo: { name: deliverName, lines: deliverLines },
    invoiceTo: { name: billName, lines: billLines },
    lines: order.lines.map((line) => ({
      no: line.line_no,
      orderRef: line.order_ref ?? "",
      eye: line.eye ?? "",
      product: line.product_name,
      sph: power(line.sph),
      cyl: power(line.cyl),
      ax: line.ax === null ? "" : `+${line.ax}`,
      add: power(line.add_power),
      price: amount(line.unit_price),
      discount: amount(
        (line.unit_price * line.quantity * line.discount_pct) / 100,
      ),
      qty: String(line.quantity),
      total: amount(line.line_total),
    })),
    totals: [
      { label: "Invoice Amount", value: amount(order.invoice_amount) },
      { label: "Discount Amount", value: amount(order.discount_amount) },
      { label: "Freight Charge", value: amount(order.freight_charge) },
      { label: "Net Amount", value: amount(net) },
      { label: "GST", value: amount(order.gst_amount) },
      { label: "Additional Tax", value: amount(order.additional_tax_amount) },
      {
        label: "Amount (Incl. Tax)",
        value: amount(order.amount_incl_tax),
        strong: true,
      },
    ],
    orderQty: String(order.order_qty ?? 1),
    lensQty: String(order.lens_qty ?? 0),
    voided: order.voided_at !== null,
  };
}
