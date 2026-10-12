/**
 * Totals for a range of ledger entries. Pure: the service loads the entries and this file adds them up.
 *
 * An invoice adds to what a customer owes and is stored positive; a payment reduces it and is stored negative; an
 * adjustment can go either way. The net movement is what the customers owe after this range, relative to its start.
 */

export type LedgerType = "invoice" | "payment" | "adjustment";

export const LEDGER_TYPE_LABEL: Record<LedgerType, string> = {
  invoice: "Invoice",
  payment: "Payment",
  adjustment: "Adjustment",
};

export interface LedgerRow {
  id: string;
  entryDate: string;
  entryType: LedgerType;
  amount: number;
  customerName: string;
  shopName: string;
  paymentMethod: string | null;
}

export interface LedgerTotals {
  invoiced: number;
  received: number;
  adjustments: number;
  net: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ledgerTotals(rows: LedgerRow[]): LedgerTotals {
  let invoiced = 0;
  let received = 0;
  let adjustments = 0;
  for (const row of rows) {
    if (row.entryType === "invoice") invoiced += row.amount;
    else if (row.entryType === "payment") received += -row.amount;
    else adjustments += row.amount;
  }
  return {
    invoiced: round2(invoiced),
    received: round2(received),
    adjustments: round2(adjustments),
    net: round2(invoiced - received + adjustments),
  };
}
