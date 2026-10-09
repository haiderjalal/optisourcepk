import { PDF_COMPANY, type PdfCompany } from "@/features/shop/pdf/company";
import { formatAmount, formatDate } from "@/lib/format";
import type {
  Customer,
  CustomerBalance,
  CustomerStatementLine,
} from "@/types/database";

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
  /** Invoiced, paid and adjustments, in the order the screen shows them. */
  summary: { label: string; value: string }[];
  closingLabel: string;
  closingValue: string;
  rows: LedgerPdfRow[];
}

export interface LedgerPdfInput {
  customer: Customer;
  lines: CustomerStatementLine[];
  balance: CustomerBalance | null;
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
  asOf,
}: LedgerPdfInput): LedgerPdfModel {
  // Same fallback as the statement screen: no balance row yet means the
  // opening balance is all there is.
  const owed = balance?.balance ?? customer.opening_balance;

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
    summary: [
      { label: "Invoiced", value: formatAmount(balance?.invoiced ?? 0) },
      { label: "Paid", value: formatAmount(balance?.paid ?? 0) },
      {
        label: "Discounts / adjustments",
        value: formatAmount(balance?.adjustments ?? 0),
      },
    ],
    closingLabel: closingLabel(owed),
    closingValue: formatAmount(owed),
    rows: lines.map((line, index) => toRow(line, index)),
  };
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
