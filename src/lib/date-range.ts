/**
 * Report dates: the range a report asks for, and the Karachi day that an
 * instant falls on.
 *
 * Shared by every report, so a bad date is handled the same way on every
 * screen and in every PDF, and "today" means the same day everywhere.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const KARACHI_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
});

function isDate(value: string | null | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  // Date.parse rolls 30 February over into March, so the date must read back unchanged.
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

/**
 * The range a report asks for: its From and To when they are valid dates,
 * otherwise the current Karachi month up to today.
 */
export function resolveDateRange(
  query: { from?: string | null; to?: string | null },
  today: string,
): { from: string; to: string } {
  return {
    from: isDate(query.from) ? query.from : `${today.slice(0, 7)}-01`,
    to: isDate(query.to) ? query.to : today,
  };
}

/** The Karachi calendar date an instant falls on, as "YYYY-MM-DD". */
export function karachiDate(at: string): string {
  return KARACHI_DAY.format(new Date(at));
}

/**
 * The UTC instants at which a Karachi date range starts (the first day's
 * midnight) and ends (the midnight after its last day). Karachi is UTC+5 all
 * year round.
 */
export function karachiRangeBounds(range: { from: string; to: string }): {
  start: string;
  end: string;
} {
  const [fromYear, fromMonth, fromDay] = range.from.split("-").map(Number);
  const [toYear, toMonth, toDay] = range.to.split("-").map(Number);
  return {
    start: new Date(
      Date.UTC(fromYear, fromMonth - 1, fromDay, -5),
    ).toISOString(),
    end: new Date(Date.UTC(toYear, toMonth - 1, toDay + 1, -5)).toISOString(),
  };
}
