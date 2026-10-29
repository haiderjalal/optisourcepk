import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getOrder } from "@/services/shop/invoice.service";
import { listCustomers } from "@/services/shop/customer.service";
import {
  listRxProducts,
  listSellableProducts,
} from "@/services/shop/product.service";
import { listSuppliers } from "@/services/shop/supplier.service";
import { OrderBuilder } from "@/features/shop/orders/OrderBuilder";
import { RxOrderForm } from "@/features/shop/rx/RxOrderForm";
import { RxInvoiceStockForm } from "@/features/shop/rx/RxInvoiceStockForm";
import { formatRxNo } from "@/lib/format";

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
  if (order.issued_at || order.billed_in) redirect(`/shop/orders/${id}`);

  const [customers, products, suppliers] = await Promise.all([
    listCustomers(),
    // An RX job card suggests RX lenses only; a stock order never sees them.
    order.is_rx ? listRxProducts() : listSellableProducts(),
    listSuppliers(),
  ]);
  // An RX order, or the invoice it was billed on, can hold shelf items too.
  const stockProducts =
    order.is_rx || order.combines_rx ? await listSellableProducts() : [];
  const label = order.is_rx
    ? formatRxNo(order.rx_no)
    : order.combines_rx
      ? `invoice ${order.invoice_no ?? order.reserved_invoice_no}`
      : `order ${order.order_no}`;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/shop/orders/${id}`}
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {order.is_rx
          ? formatRxNo(order.rx_no)
          : order.combines_rx
            ? `Invoice ${order.invoice_no ?? order.reserved_invoice_no}`
            : `Order ${order.order_no}`}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Edit {label}</h1>
      {order.combines_rx ? (
        <RxInvoiceStockForm
          invoice={order}
          lines={order.lines}
          stockProducts={stockProducts}
        />
      ) : order.is_rx ? (
        <RxOrderForm
          customers={customers}
          products={products}
          stockProducts={stockProducts}
          suppliers={suppliers}
          order={order}
          lines={order.lines}
        />
      ) : (
        <OrderBuilder
          customers={customers}
          products={products}
          order={order}
          lines={order.lines}
          daily={order.is_daily}
        />
      )}
    </div>
  );
}
