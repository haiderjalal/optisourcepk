import "server-only";

import { describePostgresError } from "./errors";

/** PostgREST returns at most this many rows per request, so longer reads are fetched a page at a time. */
export const PAGE_SIZE = 1000;

/**
 * Reads every row of a query, one page at a time. The query must end with a unique order (the id) so that pages
 * never overlap or skip rows. `action` names the read in the error message shown to staff.
 */
export async function readAllRows<T>(
  action: string,
  page: (from: number, to: number) => PromiseLike<unknown>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // The generated database types do not describe embedded relations, so each page is typed here, at the one
    // place that reads it. Each caller's select string names the columns its row type declares.
    const { data, error } = (await page(from, from + PAGE_SIZE - 1)) as {
      data: T[] | null;
      error: unknown;
    };
    if (error) throw new Error(describePostgresError(error, action));
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
