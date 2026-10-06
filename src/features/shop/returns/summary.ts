/**
 * What has come back on one invoice, in the shape the invoice page, its PDF
 * and its WhatsApp message need. Pure, so all three agree to the paisa.
 */

export interface ReturnSummary {
  /** Total credited for returns on this invoice. */
  total: number;
  /** Per invoice line: how many came back and their value. */
  byLine: Record<string, { qty: number; amount: number }>;
  /** "RET-0001, RET-0002" — for the totals label. */
  labels: string;
}

export function summariseReturns(
  returns: {
    return_no: number;
    lines: { order_line_id: string; quantity: number; amount: number }[];
  }[],
): ReturnSummary {
  const byLine: ReturnSummary["byLine"] = {};
  let total = 0;
  for (const line of returns.flatMap((r) => r.lines)) {
    const row = byLine[line.order_line_id] ?? { qty: 0, amount: 0 };
    row.qty += line.quantity;
    row.amount += Number(line.amount);
    byLine[line.order_line_id] = row;
    total += Number(line.amount);
  }
  return {
    total: Math.round(total * 100) / 100,
    byLine,
    labels: [...returns]
      .sort((a, b) => a.return_no - b.return_no)
      .map((r) => `RET-${String(r.return_no).padStart(4, "0")}`)
      .join(", "),
  };
}
