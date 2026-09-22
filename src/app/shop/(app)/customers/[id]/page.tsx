import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ReceiptText, Wallet } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getCustomer } from "@/services/shop/customer.service";
import { CustomerForm } from "@/features/shop/customers/CustomerForm";
import { archiveCustomerAction } from "@/features/shop/customers/actions";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({
  params,
}: PageProps<"/shop/customers/[id]">) {
  await requireUser();
  const { id } = await params;

  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/shop/customers"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Customers
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{customer.shop_name}</h1>
          <p className="text-navy-500 mt-1 text-sm">
            {customer.customer_name} · {customer.area}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            href={`/shop/customers/${customer.id}/statement`}
            variant="outline"
          >
            <ReceiptText className="size-4" aria-hidden />
            Statement
          </ButtonLink>
          <ButtonLink href={`/shop/payments?customer=${customer.id}`}>
            <Wallet className="size-4" aria-hidden />
            Record payment
          </ButtonLink>
        </div>
      </div>

      <CustomerForm customer={customer} />

      <form
        action={archiveCustomerAction}
        className="mt-10 border-t border-mist-200 pt-6"
      >
        <input type="hidden" name="id" value={customer.id} />
        <h2 className="text-sm font-semibold">Archive this customer</h2>
        <p className="text-navy-500 mt-1 max-w-prose text-sm">
          They stop appearing in lists. Their ledger and every invoice already
          issued are kept, so nothing in the accounts changes.
        </p>
        <button
          type="submit"
          className="mt-3 rounded-lg px-3 py-2 text-sm font-medium text-amber-700 ring-1 ring-amber-300 transition-colors ring-inset hover:bg-amber-50"
        >
          Archive customer
        </button>
      </form>
    </div>
  );
}
