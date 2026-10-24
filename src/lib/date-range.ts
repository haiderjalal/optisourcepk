/**
 * Report date ranges, read from the URL.
 *
 * Shared by every report that takes a From and To, so a bad date is handled the
 * same way on every screen and in every PDF.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
