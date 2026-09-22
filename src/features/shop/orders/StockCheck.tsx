import Link from "next/link";
import { Check, PackagePlus, TriangleAlert } from "lucide-react";
import { describeBin } from "@/lib/format";
import type { LineAvailability } from "@/services/shop/stock.service";

/**
 * Whether this order can actually be invoiced.
 *
 * Shown above the issue button so a shortage is visible before the click,
 * rather than arriving as a failed transaction. The database still does the
 * real check — this only tells the operator what it is about to find.
 */
export function StockCheck({
  lines,
  productLinks,
}: {
  lines: LineAvailability[];
  /** sku → product id, so a problem links straight to where it is fixed. */
  productLinks: Map<string, string>;
}) {
  if (lines.length === 0) return null;

  const problems = lines.filter((line) => line.missing || line.short);

  if (problems.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-5 py-3.5 text-sm text-emerald-800 ring-1 ring-emerald-200 ring-inset">
        <Check className="size-4 shrink-0" aria-hidden />
        Stock is available for every line.
      </p>
    );
  }

  return (
    <div className="rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200 ring-inset">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        Not enough stock to issue this invoice
      </h2>
      <p className="mt-1 text-sm text-amber-800">
        Receive the stock below, then come back and issue. Nothing is deducted
        until you do.
      </p>

      <ul className="mt-3 space-y-2">
        {problems.map((line, index) => {
          const id = productLinks.get(line.sku);
          const where = describeBin(line);

          return (
            <li
              key={`${line.sku}-${index}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white px-3.5 py-2.5 text-sm ring-1 ring-amber-200 ring-inset"
            >
              <span className="font-medium text-amber-900">
                {line.productName}
                {where && (
                  <span className="ml-1.5 font-mono text-xs font-normal">
                    {where}
                  </span>
                )}
              </span>
              <span className="text-amber-800">
                {line.missing
                  ? "none received"
                  : `${line.onHand} on hand, ${line.needed} needed`}
              </span>
              {id && (
                <Link
                  href={`/shop/products/${id}`}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
                >
                  <PackagePlus className="size-3.5" aria-hidden />
                  Receive stock
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
