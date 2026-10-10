import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Pencil, Plus, Search, Users, Wallet } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listCustomers } from "@/services/shop/customer.service";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { ShowMore } from "@/components/ui/show-more";
import { ShopPageHeader } from "@/features/shop/layout/ShopPageHeader";
import { listLimit } from "@/lib/list-pagination";
import { formatPkr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Shops" };

export default async function CustomersPage({
  searchParams,
}: PageProps<"/shop/customers">) {
  await requireUser();

  const params = await searchParams;
  const { q } = params;
  const search = typeof q === "string" ? q.trim() : "";
  const limit = listLimit(params.limit);
  const customers = await listCustomers(search, limit + 1);
  const hasMore = customers.length > limit;
  const visibleCustomers = customers.slice(0, limit);

  return (
    <div className="mx-auto max-w-5xl">
      <ShopPageHeader
        eyebrow="Accounts"
        title="Shops"
        description="Each shop's balance, and what you can do for it without opening the shop first."
        actions={
          <ButtonLink href="/shop/customers/new">
            <Plus className="size-4" aria-hidden />
            Add shop
          </ButtonLink>
        }
      />

      {/* A GET form: the search lives in the URL, so a result is shareable and
          the back button behaves. */}
      <form className="mb-5 flex gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-navy-300 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Shop, owner, area or phone"
            aria-label="Search shops"
            className={`${inputClass} h-11 pl-10`}
          />
        </div>
        <button
          type="submit"
          className="text-navy-600 h-11 rounded-lg border border-mist-300 bg-white px-5 text-sm font-medium transition-colors hover:bg-mist-100"
        >
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Users className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">
            {search ? "No shop matched." : "No shops yet."}
          </h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            {search
              ? "Try a shorter part of the shop, owner, area or phone."
              : "Add the shops you supply. Each one gets a ledger, and its opening balance carries over."}
          </p>
          {!search && (
            <ButtonLink href="/shop/customers/new" className="mt-6">
              <Plus className="size-4" aria-hidden />
              Add the first shop
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <div
            className="text-navy-500 hidden items-center gap-4 bg-mist-100 px-4 py-3 text-xs font-medium md:flex"
            aria-hidden
          >
            <span className="min-w-0 flex-1">Shop</span>
            <span className="w-40">Area</span>
            <span className="w-36">Phone</span>
            <span className="w-32 text-right">Balance</span>
            <span className="w-36 text-right">Actions</span>
          </div>

          <ul className="divide-y divide-mist-200">
            {visibleCustomers.map((shop) => (
              <li
                key={shop.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors hover:bg-mist-50/60"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <Link
                    href={`/shop/customers/${shop.id}/statement`}
                    className="group block"
                  >
                    <span className="group-hover:text-accent-700 block truncate text-sm font-medium">
                      {shop.shop_name}
                    </span>
                    <span className="text-navy-400 block truncate text-xs">
                      {shop.customer_name}
                    </span>
                  </Link>
                </div>

                <span className="text-navy-500 hidden w-40 truncate text-sm md:block">
                  {shop.area}
                </span>
                <span className="text-navy-500 hidden w-36 truncate text-sm md:block">
                  {shop.phone}
                </span>

                <span
                  className={cn(
                    "w-32 text-right text-sm font-semibold whitespace-nowrap tabular-nums",
                    shop.balance > 0
                      ? "text-amber-700"
                      : shop.balance < 0
                        ? "text-emerald-700"
                        : "text-navy-400",
                  )}
                >
                  <span className="text-navy-400 mr-1 text-xs font-normal md:hidden">
                    Balance
                  </span>
                  {formatPkr(shop.balance)}
                </span>

                <div className="flex w-full items-center justify-end gap-1.5 md:w-auto md:justify-end">
                  <ButtonLink
                    href={`/shop/payments?customer=${shop.id}`}
                    size="sm"
                    aria-label={`Collect payment from ${shop.shop_name}`}
                  >
                    <Wallet className="size-3.5" aria-hidden />
                    Collect
                  </ButtonLink>
                  <ButtonLink
                    href={`/shop/customers/${shop.id}/invoices/pdf?download`}
                    variant="outline"
                    size="sm"
                    prefetch={false}
                    aria-label={`Download all invoices for ${shop.shop_name}`}
                  >
                    <FileText className="size-3.5" aria-hidden />
                    PDF
                  </ButtonLink>
                  <Link
                    href={`/shop/customers/${shop.id}`}
                    aria-label={`Edit ${shop.shop_name}`}
                    title="Edit shop"
                    className="text-navy-400 hover:text-navy-700 grid size-9 place-items-center rounded-full transition-colors hover:bg-mist-100"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <ShowMore
            pathname="/shop/customers"
            searchParams={params}
            current={limit}
            hasMore={hasMore}
            noun="shops"
          />
        </div>
      )}

      {customers.length > 0 && (
        <p className="text-navy-400 mt-3 text-xs">
          A positive balance is what the shop owes. Negative means they are in
          credit.
        </p>
      )}
    </div>
  );
}
