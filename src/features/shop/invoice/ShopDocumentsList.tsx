import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { formatPkr } from "@/lib/format";
import type { CustomerWithBalance } from "@/services/shop/customer.service";

/**
 * The shops a search matched, each with the two documents that go to them:
 * every invoice combined into one PDF, and the ledger. Both download, ready to
 * be sent on.
 */
export function ShopDocumentsList({ shops }: { shops: CustomerWithBalance[] }) {
  return (
    <div className="shadow-lift mb-5 overflow-hidden rounded-2xl bg-white">
      <h2 className="text-navy-500 bg-mist-100 px-4 py-3 text-sm font-medium">
        Matching shops
      </h2>
      <ul className="divide-y divide-mist-200">
        {shops.map((shop) => (
          <li
            key={shop.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{shop.shop_name}</p>
              <p className="text-navy-500 text-sm">
                {shop.customer_name}
                {shop.area && ` · ${shop.area}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-sm font-medium tabular-nums ${
                  shop.balance > 0
                    ? "text-amber-700"
                    : shop.balance < 0
                      ? "text-emerald-700"
                      : "text-navy-400"
                }`}
              >
                {formatPkr(shop.balance)}
              </span>
              <ButtonLink
                href={`/shop/customers/${shop.id}/invoices/pdf?download`}
                variant="outline"
                size="sm"
                prefetch={false}
              >
                <Download className="size-4" aria-hidden />
                Combined PDF
              </ButtonLink>
              <ButtonLink
                href={`/shop/customers/${shop.id}/statement/pdf?download`}
                variant="outline"
                size="sm"
                prefetch={false}
              >
                <Download className="size-4" aria-hidden />
                Ledger PDF
              </ButtonLink>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
