import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listSuppliers } from "@/services/shop/supplier.service";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await requireUser();
  const suppliers = await listSuppliers();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Purchasing</p>
          <h1 className="mt-2 text-2xl font-bold">Suppliers</h1>
          <p className="text-navy-500 mt-2 max-w-prose text-sm">
            Who you buy stock from. Pick one when you record a purchase invoice.
          </p>
        </div>
        <ButtonLink href="/shop/suppliers/new">
          <Plus className="size-4" aria-hidden />
          Add supplier
        </ButtonLink>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Building2 className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">No suppliers yet.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            Add the companies you buy lenses and frames from, then record their
            invoices as stock arrives.
          </p>
          <ButtonLink href="/shop/suppliers/new" className="mt-6">
            <Plus className="size-4" aria-hidden />
            Add the first supplier
          </ButtonLink>
        </div>
      ) : (
        <div className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Suppliers</caption>
            <thead>
              <tr className="text-navy-500 bg-mist-100 text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  Supplier
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 font-medium sm:table-cell"
                >
                  City
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Phone
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-t border-mist-200 hover:bg-mist-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/shop/suppliers/${supplier.id}`}
                      className="hover:text-accent-600 font-medium"
                    >
                      {supplier.name}
                    </Link>
                  </td>
                  <td className="text-navy-500 hidden px-4 py-3 sm:table-cell">
                    {supplier.city}
                  </td>
                  <td className="text-navy-500 px-4 py-3">{supplier.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
