/**
 * The look and arithmetic of an order's lines table, shared by every editor that
 * shows one: the order builder, the stock items on an RX order or invoice, and
 * the lenses on a reopened RX invoice. They read as one table design.
 */

/** An input or select inside a lines-table cell. */
export const lineCell =
  "border-mist-300 focus:border-accent-600 w-full rounded-md border bg-white px-2 py-1.5 text-sm outline-none transition-colors";

/**
 * A line's total from what is typed, for immediate feedback. Rounded the way the
 * database rounds it: the gross to the paisa, then the discount to the paisa.
 * The invoice's own figures are always worked out again by the database.
 */
export function lineAmount(
  rate: string,
  quantity: string,
  discountPct: string,
): number {
  const price = Number(rate) || 0;
  const qty = Number(quantity) || 0;
  const discount = Number(discountPct) || 0;
  const gross = Math.round(price * qty * 100) / 100;
  return gross - Math.round(((gross * discount) / 100) * 100) / 100;
}
