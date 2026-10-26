import { PDF_COMPANY, type PdfCompany } from "@/features/shop/pdf/company";
import {
  stockReportNotes,
  stockReportTotals,
  type StockReport,
} from "@/features/shop/stock/report";
import { formatAmount, formatDate } from "@/lib/format";

/**
 * What the stock report PDF draws.
 *
 * Built from the same rows and totals the report screen shows, so the PDF and
 * the screen cannot disagree. A plain serialisable object: the renderer does no
 * lookups.
 */

export interface StockPdfRow {
  key: string;
  /** One value per column of its section, in order. */
  cells: string[];
  /** The amount is missing (no price), so it is flagged. */
  flagged: boolean;
}

export interface StockPdfSection {
  title: string;
  rows: StockPdfRow[];
  /** One value per column, in order. Blank cells are left empty. */
  total: string[];
}

export interface StockReportPdfModel {
  company: PdfCompany;
  /** "01 Oct 2026 to 21 Oct 2026". */
  period: string;
  purchases: StockPdfSection;
  register: StockPdfSection;
  sales: StockPdfSection;
  notes: string[];
}

export interface StockReportPdfInput {
  report: StockReport;
  from: string;
  to: string;
}

const CHANNEL_LABEL = { normal: "Normal", daily: "Daily" } as const;

export function buildStockReportPdfModel({
  report,
  from,
  to,
}: StockReportPdfInput): StockReportPdfModel {
  const totals = stockReportTotals(report);

  return {
    company: PDF_COMPANY,
    period: `${formatDate(from)} to ${formatDate(to)}`,
    purchases: {
      title: "Purchases from suppliers",
      rows: report.purchases.map((row) => ({
        key: row.lineId,
        cells: [
          formatDate(row.date),
          row.invoiceNo,
          row.supplier,
          row.product,
          row.power,
          String(row.quantity),
          formatAmount(row.purchasedPrice),
          row.salePrice === null ? "—" : formatAmount(row.salePrice),
          formatAmount(row.amount),
        ],
        flagged: false,
      })),
      total: [
        "",
        "",
        "",
        "Total",
        "",
        String(totals.purchasedQuantity),
        formatAmount(totals.purchasedAtCost),
        formatAmount(totals.purchasedAtSalePrice),
        formatAmount(totals.purchasedAmount),
      ],
    },
    register: {
      title: "Daily stock register",
      rows: report.register.map((row) => ({
        key: row.entryId,
        cells: [
          formatDate(row.date),
          row.product,
          row.unit,
          String(row.opening),
          String(row.received),
          String(row.outgoing),
          String(row.closing),
          row.note ?? "",
        ],
        flagged: false,
      })),
      total: [
        "",
        "Total",
        "",
        "",
        String(totals.received),
        String(totals.sold),
        "",
        "",
      ],
    },
    sales: {
      title: "Sales on invoices (normal and daily stock)",
      rows: report.sales.map((row) => ({
        key: row.lineId,
        cells: [
          formatDate(row.date),
          row.invoiceNo === null ? "—" : String(row.invoiceNo),
          CHANNEL_LABEL[row.channel],
          row.shop,
          row.product,
          String(row.quantity),
          row.purchasedPrice === null ? "—" : formatAmount(row.purchasedPrice),
          formatAmount(row.salePrice),
          row.salePrice === 0 ? "no price" : formatAmount(row.amount),
        ],
        flagged: row.salePrice === 0,
      })),
      total: [
        "",
        "",
        "",
        "",
        "Total",
        String(totals.soldQuantity),
        formatAmount(totals.soldAtCost),
        formatAmount(totals.soldAtSalePrice),
        formatAmount(totals.soldAmount),
      ],
    },
    notes: stockReportNotes(totals),
  };
}
