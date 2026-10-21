import { PDF_COMPANY, type PdfCompany } from "@/features/shop/pdf/company";
import {
  labReportNotes,
  labReportTotalLabel,
  type RxLabRow,
  type RxLabTotals,
} from "@/features/shop/rx/labReport";
import { formatAmount, formatDate, formatRxNo } from "@/lib/format";

/**
 * What the RX lab report PDF draws.
 *
 * Built from the same rows and totals the report screen shows, so the PDF and
 * the screen cannot disagree. A plain serialisable object: the renderer does no
 * lookups.
 */

export interface RxLabPdfRow {
  key: string;
  rxNo: string;
  date: string;
  labOrderNo: string;
  lab: string;
  patient: string;
  shop: string;
  voided: boolean;
  lenses: string;
  purchase: string;
  /** No purchase total: the cell reads "no cost" and is flagged. */
  purchaseMissing: boolean;
  sale: string;
}

export interface RxLabPdfModel {
  company: PdfCompany;
  /** "01 Oct 2026 to 21 Oct 2026". */
  period: string;
  rows: RxLabPdfRow[];
  totals: {
    label: string;
    lenses: string;
    purchase: string;
    sale: string;
  };
  notes: string[];
}

export interface RxLabPdfInput {
  rows: RxLabRow[];
  totals: RxLabTotals;
  /** `YYYY-MM-DD`, first day of the range. */
  from: string;
  /** `YYYY-MM-DD`, last day of the range. */
  to: string;
}

export function buildRxLabPdfModel({
  rows,
  totals,
  from,
  to,
}: RxLabPdfInput): RxLabPdfModel {
  return {
    company: PDF_COMPANY,
    period: `${formatDate(from)} to ${formatDate(to)}`,
    rows: rows.map(toRow),
    totals: {
      label: labReportTotalLabel(totals),
      lenses: String(totals.lenses),
      purchase: formatAmount(totals.purchase),
      sale: formatAmount(totals.sale),
    },
    notes: labReportNotes(totals),
  };
}

function toRow(row: RxLabRow): RxLabPdfRow {
  return {
    key: row.orderId,
    rxNo: formatRxNo(row.rxNo),
    date: formatDate(row.date),
    labOrderNo: row.labOrderNo ?? "—",
    lab: row.lab,
    patient: row.patientName ?? "—",
    shop: row.shopName,
    voided: row.voided,
    lenses: String(row.lenses),
    purchase: row.purchase === null ? "no cost" : formatAmount(row.purchase),
    purchaseMissing: row.purchase === null,
    sale: row.sale === null ? "—" : formatAmount(row.sale),
  };
}
