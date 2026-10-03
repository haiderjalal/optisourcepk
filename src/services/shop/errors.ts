import "server-only";

import { logger } from "@/lib/logger";

/**
 * Turn a Postgres error into something a person can act on.
 *
 * Two rules: the operator sees a sentence that tells them what to do, and the
 * raw error — which carries table names, constraint names and SQL — goes to
 * the log and nowhere else.
 */

interface PostgresErrorShape {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * SQLSTATEs whose message text we wrote ourselves, in `0001_backoffice.sql`.
 * Those are already phrased for the operator ("Insufficient stock: …",
 * "Invoice 1042 has been issued…"), so they pass through verbatim.
 */
const OUR_OWN = new Set([
  "P0001", // raise_exception — a bare RAISE in one of our functions
  "23001", // restrict_violation — what our guards raise deliberately
]);

/** Constraint names worth explaining specifically. */
const CONSTRAINTS: Record<string, string> = {
  customers_shop_area_uq:
    "A customer with that shop name already exists in that area. Open the existing record instead of adding a second one — two records would split their ledger.",
  orders_invoice_no_key: "That invoice number has already been issued.",
  stock_bins_product_sph_uq:
    "That product and power already has a stock bin. Adjust the existing one.",
  stock_bins_sph_matches_product:
    "Power-tracked products need an SPH, and products that are not power-tracked must not have one.",
  ledger_one_per_invoice: "That invoice has already been posted to the ledger.",
  suppliers_name_uq: "A supplier with that name already exists.",
  order_lines_ax_needs_cyl:
    "An axis needs a cylinder value. Enter the CYL, or clear the axis.",
  order_lines_ax_range: "Axis runs from 0 to 180.",
  order_lines_sph_step: "SPH runs from -30 to +30 in 0.25 steps.",
  order_lines_cyl_step: "CYL runs from -12 to +12 in 0.25 steps.",
  order_lines_add_step: "ADD runs from 0 to 6 in 0.25 steps.",
  orders_rx_lens_type_valid:
    "Pick SV, KRY, DBF, PROG or Blended for the lens type — the database needs the latest update (migration 0024).",
  stock_bins_qty_on_hand_check:
    "That would take the stock below zero. Check the quantity on hand first.",
};

function matchedConstraint(text: string): string | undefined {
  for (const [name, message] of Object.entries(CONSTRAINTS)) {
    if (text.includes(name)) return message;
  }
  return undefined;
}

/**
 * @param action what the user was trying to do, phrased to slot into
 *   "We could not {action}." — e.g. "save the customer".
 */
export function describePostgresError(error: unknown, action: string): string {
  const e = (error ?? {}) as PostgresErrorShape;
  const code = e.code ?? "unknown";
  const raw = `${e.message ?? ""} ${e.details ?? ""}`;

  logger.error("Database error", { action, code, message: e.message });

  if (OUR_OWN.has(code) && e.message) return e.message;

  const explained = matchedConstraint(raw);
  if (explained) return explained;

  switch (code) {
    case "23505":
      return "That record already exists.";
    case "23514":
      return "Some of those values are out of range. Check the powers, quantities and percentages.";
    case "23503":
      return "That record is still referenced by an invoice or a ledger entry, so it cannot be changed this way.";
    case "42501":
      return "You do not have permission to do that. Try signing in again.";
    case "PGRST301":
    case "PGRST302":
      return "Your session has expired. Please sign in again.";
    // A column or table the app expects is not in the database (42703/42P01),
    // or the API has not picked it up yet (PGRST204/PGRST205).
    case "PGRST202":
    case "PGRST204":
    case "PGRST205":
    case "42703":
    case "42P01":
      return `We could not ${action}: the database is missing its latest update. Run the newest files in supabase/migrations in the Supabase SQL Editor, then try again. If you already ran them, run: notify pgrst, 'reload schema';`;
    default:
      return `We could not ${action}. Please try again — if it keeps happening, the error reference is ${code}.`;
  }
}
