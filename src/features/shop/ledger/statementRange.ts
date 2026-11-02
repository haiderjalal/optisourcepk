import { formatDate } from "@/lib/format";
import type { CustomerStatementLine } from "@/types/database";

/**
 * The period a customer statement covers, as `YYYY-MM-DD` days. An open side
 * is the start of the account (no From) or today (no To).
 */
export interface StatementPeriod {
  from: string | null;
  to: string | null;
}

export interface StatementSlice<T extends CustomerStatementLine> {
  /** The entries dated within the period, in statement order. */
  lines: T[];
  /** The balance carried in from before the period. Null when there is no From date. */
  broughtForward: number | null;
  /** The balance at the end of the period, which is the account's own balance when there is no To date. */
  closing: number;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A day from the page address, or null when it is blank or not a real day.
 * The round trip rejects days that JavaScript would roll over, such as 30 Feb.
 */
export function readStatementDay(
  value: string | null | undefined,
): string | null {
  if (!value || !DAY_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

/** "1 Oct 2026 to 31 Oct 2026", or the one open side, or null for the whole account. */
export function describeStatementPeriod({
  from,
  to,
}: StatementPeriod): string | null {
  if (from !== null && to !== null) {
    return `${formatDate(from)} to ${formatDate(to)}`;
  }
  if (from !== null) return `From ${formatDate(from)}`;
  if (to !== null) return `Up to ${formatDate(to)}`;
  return null;
}

/** Both dates are set and the From date is after the To date. */
export function isReversedPeriod(period: StatementPeriod): boolean {
  return period.from !== null && period.to !== null && period.from > period.to;
}

/**
 * The entries in a period, each keeping its running balance. That balance is
 * the whole account's, so it is read, not summed again, and each row still
 * agrees with the one above it.
 *
 * `owed` is the account's balance today, used as the closing balance when the
 * period has no end.
 */
export function statementSlice<T extends CustomerStatementLine>(
  lines: T[],
  period: StatementPeriod,
  owed: number,
): StatementSlice<T> {
  const { from, to } = period;

  const within = lines.filter(
    (line) =>
      (from === null || line.entry_date >= from) &&
      (to === null || line.entry_date <= to),
  );
  const broughtForward =
    from === null
      ? null
      : (lines.filter((line) => line.entry_date < from).at(-1)
          ?.running_balance ?? 0);
  const closing =
    to === null
      ? owed
      : (within.at(-1)?.running_balance ?? broughtForward ?? 0);

  return { lines: within, broughtForward, closing };
}
