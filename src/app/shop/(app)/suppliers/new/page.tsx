import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { SupplierForm } from "@/features/shop/suppliers/SupplierForm";

export const metadata: Metadata = { title: "Add supplier" };

export default async function NewSupplierPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/shop/suppliers"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Suppliers
      </Link>

      <h1 className="mb-6 text-2xl font-bold">Add supplier</h1>
      <SupplierForm />
    </div>
  );
}
