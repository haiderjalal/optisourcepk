/**
 * Display formatting for the back-office.
 *
 * Pure functions, no React. Every amount the operator sees goes through here
 * so a rupee value never renders two different ways on two screens.
 */

const PKR = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `2400` → `"2,400.00"`. No symbol: the column header carries the currency. */
export function formatAmount(value: number): string {
  return PKR.format(value);
}

/** `2400` → `"Rs 2,400.00"`, for standalone figures with no column header. */
export function formatPkr(value: number): string {
  return `Rs ${PKR.format(value)}`;
}

/**
 * A dioptre value as an optician writes it: always signed, always two
 * decimals. `-0.5` → `"-0.50"`, `1.5` → `"+1.50"`, `0` → `"0.00"`.
 */
export function formatPower(value: number | null): string {
  if (value === null) return "";
  if (value === 0) return "0.00";
  return `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(2)}`;
}

/** Axis prints as a whole number of degrees. */
export function formatAxis(value: number | null): string {
  return value === null ? "" : String(value);
}

const DATE = new Intl.DateTimeFormat("en-PK", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Karachi",
});

const DATE_TIME = new Intl.DateTimeFormat("en-PK", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Karachi",
});

/** Business dates are stored as plain `date`; render them without a timezone shift. */
export function formatDate(value: string | null): string {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(value);
  return DATE.format(date);
}

export function formatDateTime(value: string | null): string {
  return value ? DATE_TIME.format(new Date(value)) : "";
}

/** Today in Asia/Karachi as `YYYY-MM-DD`, for date input defaults. */
export function todayInKarachi(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
    new Date(),
  );
}

/**
 * The shelf position of one stock bin, as the operator reads it: "-2.00 -0.50
 * A+1.50 R". Blank for a product held without any prescription attributes.
 *
 * Lives here rather than beside the stock components because both server and
 * client render it, and a helper exported from a "use client" module cannot be
 * called from a Server Component.
 */
export function describeBin(bin: {
  sph: number | null;
  cyl: number | null;
  add_power: number | null;
  eye: string | null;
}): string {
  const parts: string[] = [];
  if (bin.sph !== null) parts.push(formatPower(bin.sph));
  if (bin.cyl !== null) parts.push(formatPower(bin.cyl));
  if (bin.add_power !== null) parts.push(`A${formatPower(bin.add_power)}`);
  if (bin.eye) parts.push(bin.eye);
  return parts.join(" ");
}
