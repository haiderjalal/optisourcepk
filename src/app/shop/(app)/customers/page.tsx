import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listCustomers } from "@/services/shop/customer.service";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { formatAmount } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: PageProps<"/shop/customers">) {
  await requireUser();

  const { q } = await searchParams;
  const search = typeof q === "string" ? q : undefined;
  const customers = await listCustomers(search);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Accounts</p>
          <h1 className="mt-2 text-2xl font-bold">Customers</h1>
        </div>
        <ButtonLink href="/shop/customers/new">
          <Plus className="size-4" aria-hidden />
          Add customer
        </ButtonLink>
      </div>

      {/* A GET form: the search term lives in the URL, so a result list is
          shareable and the back button behaves. */}
      <form className="mb-5 flex gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-navy-300 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Shop, contact, area or phone"
            aria-label="Search customers"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button
          type="submit"
          className="text-navy-600 rounded-lg border border-mist-300 bg-white px-4 text-sm font-medium transition-colors hover:bg-mist-100"
        >
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Users className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">
            {search ? "No customers matched." : "No customers yet."}
          </h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            {search
              ? "Try a shorter search — part of the shop name or the area."
              : "Add the shops you supply. Each one gets a ledger, and their opening balance carries over."}
          </p>
          {!search && (
            <ButtonLink href="/shop/customers/new" className="mt-6">
              <Plus className="size-4" aria-hidden />
              Add the first customer
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Customers with their current account balance
            </caption>
            <thead>
              <tr className="text-navy-500 bg-mist-100 text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  Shop
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-medium sm:table-cell"
                >
                  Area
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-medium md:table-cell"
                >
                  Phone
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Balance (Rs)
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-t border-mist-200 hover:bg-mist-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/shop/customers/${customer.id}`}
                      className="hover:text-accent-600 font-medium"
                    >
                      {customer.shop_name}
                    </Link>
                    <span className="text-navy-400 block text-xs">
                      {customer.customer_name}
                    </span>
                  </td>
                  <td className="text-navy-500 hidden px-4 py-3 sm:table-cell">
                    {customer.area}
                  </td>
                  <td className="text-navy-500 hidden px-4 py-3 md:table-cell">
                    {customer.phone}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium tabular-nums ${
                      customer.balance > 0
                        ? "text-amber-700"
                        : customer.balance < 0
                          ? "text-emerald-700"
                          : "text-navy-400"
                    }`}
                  >
                    {formatAmount(customer.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
