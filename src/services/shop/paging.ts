/**
 * Read every row of a query, not just the first page.
 *
 * Supabase's API returns at most "Max Rows" (1,000 by default) per request
 * and silently drops the rest. Stock is one row per power, so a handful of
 * lens products passes 1,000 — and the rows cut off were the newest
 * product's, which then showed as all zeros on the stock screen.
 *
 * Pages are read until one comes back empty, rather than until one comes back
 * short: a project configured with a lower Max Rows would otherwise stop
 * after its first page. The caller's query must have a stable order.
 */

export interface PageResult<T> {
  data: T[] | null;
  error: { code?: string; message?: string } | null;
}

export const PAGE_SIZE = 1000;

/** A safety stop: 200 pages is 200,000 rows, far past any real shop. */
const MAX_PAGES = 200;

export async function selectAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = rows.length;
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }

  return rows;
}
