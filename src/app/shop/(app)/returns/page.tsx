import type { Metadata } from "next";
import { Undo2 } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listReturns } from "@/services/shop/return.service";
import { ReturnsList } from "@/features/shop/returns/ReturnsList";
import { ShowMore } from "@/components/ui/show-more";
import { listLimit } from "@/lib/list-pagination";
import { formatPkr } from "@/lib/format";

export const metadata: Metadata = { title: "Returns" };

export default async function ReturnsPage({
  searchParams,
}: PageProps<"/shop/returns">) {
  await requireUser();
  const params = await searchParams;
  const limit = listLimit(params.limit);
  const returns = await listReturns({ limit: limit + 1 });
  const hasMore = returns.length > limit;
  const visible = returns.slice(0, limit);
  const shownTotal = visible.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="eyebrow text-accent-600">Trade</p>
        <h1 className="mt-2 text-2xl font-bold">Returns</h1>
        <p className="text-navy-500 mt-2 max-w-prose text-sm">
          Items shops sent back, with when, from which invoice, and how much was
          credited. To record one, open the invoice and use Return items.
        </p>
      </div>

      {returns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Undo2 className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">No returns yet.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            When a shop sends items back, open its invoice and choose Return
            items. Each return is listed here.
          </p>
        </div>
      ) : (
        <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-mist-200 px-5 py-3 text-sm">
            <span className="text-navy-500">
              Showing {visible.length}{" "}
              {visible.length === 1 ? "return" : "returns"}
            </span>
            <span>
              <span className="text-navy-500">Credited </span>
              <span className="font-semibold tabular-nums">
                {formatPkr(shownTotal)}
              </span>
            </span>
          </div>
          <ReturnsList returns={visible} />
          <ShowMore
            pathname="/shop/returns"
            searchParams={params}
            current={limit}
            hasMore={hasMore}
            noun="returns"
          />
        </div>
      )}
    </div>
  );
}
