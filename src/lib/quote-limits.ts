/**
 * Limits on a trade request, shared by the request-list store (client) and the
 * inquiry schema (server).
 *
 * Kept free of imports on purpose: the store is read by the header on every
 * page, so anything it imports ships site-wide. Zod in particular must not
 * reach this module.
 */

/** A request covers at most this many catalogue lines. */
export const MAX_QUOTE_LINES = 40;

/** Upper bound on the count of any single line — matches the server schema. */
export const MAX_LINE_QUANTITY = 1_000_000;
