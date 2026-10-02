export const LIST_PAGE_SIZE = 5;
export const MAX_LIST_ITEMS = 100;

export type ListSearchParams = Record<string, string | string[] | undefined>;

/** A safe cumulative list size from the URL (5, 10, 15, ...). */
export function listLimit(value: string | string[] | undefined): number {
  if (typeof value !== "string") return LIST_PAGE_SIZE;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < LIST_PAGE_SIZE) {
    return LIST_PAGE_SIZE;
  }
  return Math.min(
    MAX_LIST_ITEMS,
    Math.ceil(parsed / LIST_PAGE_SIZE) * LIST_PAGE_SIZE,
  );
}

export function listHref(
  pathname: string,
  searchParams: ListSearchParams,
  key: string,
  value: number,
): string {
  const query = new URLSearchParams();

  for (const [name, raw] of Object.entries(searchParams)) {
    if (name === key || raw === undefined) continue;
    if (Array.isArray(raw)) raw.forEach((item) => query.append(name, item));
    else query.set(name, raw);
  }

  if (value > LIST_PAGE_SIZE) query.set(key, String(value));
  const suffix = query.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}
