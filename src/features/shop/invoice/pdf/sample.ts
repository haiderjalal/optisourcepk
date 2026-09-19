import type { InvoicePdfModel } from "./model";

/**
 * The reference invoice, as data.
 *
 * These are the exact figures from the supplier invoice the format is copied
 * from (`docs/reference/`), so the rendered document can be held next to the
 * original and compared column by column. It also exercises the two cases the
 * layout exists for: one job split across two eyes, and service lines that
 * carry no power values.
 */
export const SAMPLE_INVOICE: InvoicePdfModel = {
  company: {
    name: "OptiSource PK — Wholesale Optics",
    address:
      "Shop 2 & 3 Basement, Nawaz Plaza, Jehangir Market, G-9/2, Islamabad, Pakistan",
    phone: "+92 51 232 4512 · WhatsApp +92 325 3965832",
  },
  invoiceNo: "292055",
  issuedAt: "18/09/2026 13:10",
  courier: "A to Z Courier",
  trackingNo: "",
  priority: "URGENT",
  orderBy: { name: "DEVARTSON OPTICS", lines: [] },
  deliverTo: {
    name: "DEVARTSON OPTICS",
    lines: ["Jinnah Super Market, F-7", "Islamabad", "PAKISTAN"],
  },
  invoiceTo: {
    name: "DEVARTSON OPTICS",
    lines: ["Imran Shah", "Jinnah Super Market, F-7", "Islamabad", "PAKISTAN"],
  },
  lines: [
    {
      no: 1,
      orderRef: "431110",
      eye: "R",
      product: "E-Series Progressive Clear 1.50",
      sph: "-0.75",
      cyl: "-0.50",
      ax: "+15",
      add: "+1.50",
      price: "700.00",
      discount: "0.00",
      qty: "1",
      total: "700.00",
    },
    {
      no: 2,
      orderRef: "431110",
      eye: "L",
      product: "E-Series Progressive Clear 1.50",
      sph: "-1.00",
      cyl: "-0.25",
      ax: "+15",
      add: "+1.50",
      price: "700.00",
      discount: "0.00",
      qty: "1",
      total: "700.00",
    },
    {
      no: 3,
      orderRef: "431110",
      eye: "",
      product: "UNCOAT",
      sph: "",
      cyl: "",
      ax: "",
      add: "",
      price: "0.00",
      discount: "0.00",
      qty: "2",
      total: "0.00",
    },
    {
      no: 4,
      orderRef: "431110",
      eye: "",
      product: "GRADIAL GREY",
      sph: "",
      cyl: "",
      ax: "",
      add: "",
      price: "500.00",
      discount: "0.00",
      qty: "2",
      total: "1,000.00",
    },
  ],
  totals: [
    { label: "Invoice Amount", value: "2,400.00" },
    { label: "Discount Amount", value: "0.00" },
    { label: "Freight Charge", value: "0.00" },
    { label: "Net Amount", value: "2,400.00" },
    { label: "GST", value: "0.00" },
    { label: "Additional Tax", value: "0.00" },
    { label: "Amount (Incl. Tax)", value: "2,400.00", strong: true },
  ],
  orderQty: "1",
  lensQty: "2",
  voided: false,
};
