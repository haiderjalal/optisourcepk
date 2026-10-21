import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getCustomer } from "@/services/shop/customer.service";
import { getLedgerEntry } from "@/services/shop/ledger.service";
import {
  LedgerEntryEditForm,
  type LedgerEntryDraft,
} from "@/features/shop/ledger/LedgerEntryEditForm";

export const metadata: Metadata = { title: "Edit payment" };

export default async function EditLedgerEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const entry = await getLedgerEntry(id);
  if (!entry) notFound();

  const back = (
    <Link
      href="/shop/payments"
      className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Ledger & payments
    </Link>
  );

  // Invoices, voids and returns are changed through their own documents.
  if (
    entry.entry_type === "invoice" ||
    entry.order_id !== null ||
    entry.return_id !== null
  ) {
    return (
      <div className="mx-auto max-w-2xl">
        {back}
        <h1 className="mb-4 text-2xl font-bold">
          This entry cannot be edited here
        </h1>
        <p className="text-navy-500 text-sm">
          Only a payment or an adjustment entered by hand is edited here. This
          one belongs to an invoice, a void or a return.
        </p>
      </div>
    );
  }

  const customer = await getCustomer(entry.customer_id);

  const draft: LedgerEntryDraft = {
    id: entry.id,
    kind: entry.entry_type === "payment" ? "payment" : "adjustment",
    customerName: customer?.shop_name ?? "—",
    entryDate: entry.entry_date,
    amount: Math.abs(entry.amount),
    method: entry.payment_method,
    reference: entry.reference,
    memo: entry.memo,
  };

  return (
    <div className="mx-auto max-w-2xl">
      {back}
      <h1 className="mb-6 text-2xl font-bold">
        Edit {draft.kind === "payment" ? "payment" : "adjustment"}
      </h1>
      <LedgerEntryEditForm entry={draft} />
    </div>
  );
}
