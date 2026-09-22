import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getOrder } from "@/services/shop/invoice.service";
import { listCustomers } from "@/services/shop/customer.service";
import { listSellableProducts } from "@/services/shop/product.service";
import { OrderBuilder } from "@/features/shop/orders/OrderBuilder";

export const metadata: Metadata = { title: "Edit order" };

export default async function EditOrderPage({
  params,
}: PageProps<"/shop/orders/[id]/edit">) {
  await requireUser();
  const { id } = await params;

  const order = await getOrder(id);
  if (!order) notFound();

  // An issued invoice is frozen by the database. Send them to the read-only
  // view rather than showing a form whose save would be refused.
  if (order.issued_at) redirect(`/shop/orders/${id}`);

  const [customers, products] = await Promise.all([
    listCustomers(),
    listSellableProducts(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/shop/orders/${id}`}
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Order {order.order_no}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Edit order {order.order_no}</h1>
      <OrderBuilder
        customers={customers}
        products={products}
        order={order}
        lines={order.lines}
      />
    </div>
  );
}
