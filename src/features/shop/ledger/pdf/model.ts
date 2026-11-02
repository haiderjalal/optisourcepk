import { PDF_COMPANY, type PdfCompany } from "@/features/shop/pdf/company";
import { formatAmount, formatDate } from "@/lib/format";
import type {
  Customer,
  CustomerBalance,
  CustomerStatementLine,
} from "@/types/database";
import {
  describeStatementPeriod,
  type StatementPeriod,
} from "../statementRange";

/**
 * What the ledger PDF draws.
 *
 * Built from the same statement lines and balance the statement screen reads,
 * so the PDF and the screen cannot disagree. A plain serialisable object: the
 * renderer does no lookups.
 */

export interface LedgerPdfRow {
  key: string;
  date: string;
  detail: string;
  /** An invoice's description, printed under its number. */
  note: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface LedgerPdfModel {
  company: PdfCompany;
  shopName: string;
  owner: string;
  addressLines: string[];
  asOf: string;
  /** "1 Oct 2026 to 31 Oct 2026", or null when the statement is the whole account. */
  periodLabel: string | null;
  /** Invoiced, paid and adjustments, in the order the screen shows them. */
  summary: { label: string; value: string }[];
  closingLabel: string;
  closingValue: string;
  rows: LedgerPdfRow[];
}

export interface LedgerPdfInput {
  customer: Customer;
  /** The entries in the period, in statement order. */
  lines: CustomerStatementLine[];
  balance: CustomerBalance | null;
  period: StatementPeriod;
  /** The balance carried in before the period, or null when the period has no start. */
  broughtForward: number | null;
  /** The balance at the end of the period. */
  closing: number;
  /** `YYYY-MM-DD`: the day the statement is run. */
  asOf: string;
}

type SaleType = NonNullable<CustomerStatementLine["sale_type"]>;

const SALE_TYPE_LABEL: Record<SaleType, string> = {
  rx: "RX",
  stock: "STOCK",
  adjustment: "ADJUSTMENT",
};

export function buildLedgerPdfModel({
  customer,
  lines,
  balance,
  period,
  broughtForward,
  closing,
  asOf,
}: LedgerPdfInput): LedgerPdfModel {
  return {
    company: PDF_COMPANY,
    shopName: customer.shop_name,
    owner: customer.customer_name,
    addressLines: present(
      customer.address,
      customer.area,
      customer.phone,
      customer.ntn ? `NTN ${customer.ntn}` : null,
      customer.strn ? `STRN ${customer.strn}` : null,
    ),
    asOf: formatDate(asOf),
    periodLabel: describeStatementPeriod(period),
    summary: [
      { label: "Invoiced", value: formatAmount(balance?.invoiced ?? 0) },
      { label: "Paid", value: formatAmount(balance?.paid ?? 0) },
      {
        label: "Discounts / adjustments",
        value: formatAmount(balance?.adjustments ?? 0),
      },
    ],
    closingLabel: closingLabel(closing),
    closingValue: formatAmount(closing),
    rows: [
      ...broughtForwardRow(broughtForward),
      ...lines.map((line, index) => toRow(line, index)),
    ],
  };
}

/** The balance carried in before the period, as the first row of its table. */
function broughtForwardRow(balance: number | null): LedgerPdfRow[] {
  if (balance === null) return [];
  return [
    {
      key: "brought-forward",
      date: "",
      detail: "Balance brought forward",
      note: "",
      debit: "",
      credit: "",
      balance: formatAmount(balance),
    },
  ];
}

function toRow(line: CustomerStatementLine, index: number): LedgerPdfRow {
  const isInvoice = line.invoice_no !== null;

  return {
    key: line.entry_id ?? `opening-${index}`,
    date: formatDate(line.entry_date),
    detail: isInvoice ? invoiceLabel(line) : line.description,
    note: isInvoice ? line.description : "",
    debit: line.debit === null ? "" : formatAmount(line.debit),
    credit: line.credit === null ? "" : formatAmount(line.credit),
    balance: formatAmount(line.running_balance),
  };
}

function invoiceLabel(line: CustomerStatementLine): string {
  const base = `Invoice ${line.invoice_no}`;
  return line.sale_type ? `${base} · ${SALE_TYPE_LABEL[line.sale_type]}` : base;
}

/** The word beside the closing figure, so a credit never reads as a debt. */
function closingLabel(owed: number): string {
  if (owed > 0) return "Balance due";
  if (owed < 0) return "Credit in hand";
  return "Settled";
}

/** Drop empties so the account box never prints a blank line. */
function present(...values: (string | null | undefined)[]): string[] {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}
