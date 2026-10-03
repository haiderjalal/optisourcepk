import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsDown } from "lucide-react";
import {
  LIST_PAGE_SIZE,
  MAX_LIST_ITEMS,
  listHref,
  type ListSearchParams,
} from "@/lib/list-pagination";

interface ShowMoreProps {
  pathname: string;
  searchParams: ListSearchParams;
  param?: string;
  current: number;
  hasMore: boolean;
  noun?: string;
}

/**
 * Server-rendered cumulative pagination: five rows first, then five more or
 * all of them on demand.
 */
export function ShowMore({
  pathname,
  searchParams,
  param = "limit",
  current,
  hasMore,
  noun = "records",
}: ShowMoreProps) {
  const canShowMore = hasMore && current < MAX_LIST_ITEMS;
  if (!canShowMore && current <= LIST_PAGE_SIZE) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-t border-mist-200 px-4 py-3">
      {canShowMore && (
        <Link
          href={listHref(
            pathname,
            searchParams,
            param,
            current + LIST_PAGE_SIZE,
          )}
          prefetch={false}
          scroll={false}
          className="text-accent-700 hover:text-accent-800 inline-flex items-center gap-1.5 text-sm font-semibold"
        >
          <ChevronDown className="size-4" aria-hidden />
          Show 5 more {noun}
        </Link>
      )}
      {canShowMore && (
        <Link
          href={listHref(pathname, searchParams, param, MAX_LIST_ITEMS)}
          prefetch={false}
          scroll={false}
          className="text-accent-700 hover:text-accent-800 inline-flex items-center gap-1.5 text-sm font-semibold"
        >
          <ChevronsDown className="size-4" aria-hidden />
          Show all {noun}
        </Link>
      )}
      {current > LIST_PAGE_SIZE && (
        <Link
          href={listHref(pathname, searchParams, param, LIST_PAGE_SIZE)}
          prefetch={false}
          scroll={false}
          className="text-navy-500 hover:text-navy-700 inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <ChevronUp className="size-4" aria-hidden />
          Show only first 5
        </Link>
      )}
    </div>
  );
}
