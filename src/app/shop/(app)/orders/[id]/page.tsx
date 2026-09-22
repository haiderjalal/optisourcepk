import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, Pencil } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getOrder } from "@/services/shop/invoice.service";
import { checkOrderStock } from "@/services/shop/stock.service";
import { listSellableProducts } from "@/services/shop/product.service";
import { StockCheck } from "@/features/shop/orders/StockCheck";
import { DeleteDraftPanel } from "@/features/shop/orders/DeleteDraftPanel";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/features/shop/orders/StatusBadge";
import {
  DispatchPanel,
  IssuePanel,
  VoidPanel,
} from "@/features/shop/orders/InvoiceActions";
import { formatAmount, formatDateTime, formatPower } from "@/lib/format";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({
  params,
}: PageProps<"/shop/orders/[id]">) {
  await requireUser();
  const { id } = await params;

  const order = await getOrder(id);
  if (!order) notFound();

  // Only worth checking while it can still be acted on.
  const canIssue = order.issued_at === null && order.voided_at === null;
  const [availability, products] = canIssue
    ? await Promise.all([checkOrderStock(id), listSellableProducts()])
    : [[], []];
  const productLinks = new Map(products.map((p) => [p.sku, p.id]));

  const issued = order.issued_at !== null;
  const voided = order.voided_at !== null;
  const subtotal = order.lines.reduce((sum, line) => sum + line.line_total, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/shop/orders"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold">
              {issued
                ? `Invoice ${order.invoice_no}`
                : `Order ${order.order_no}`}
            </h1>
            <StatusBadge order={order} />
          </div>
          <p className="text-navy-500 mt-1.5 text-sm">
            {order.customer?.shop_name ?? order.bill_to_shop ?? "—"}
            {order.customer?.area ? ` · ${order.customer.area}` : ""}
            {issued && ` · issued ${formatDateTime(order.issued_at)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {issued && (
            <>
              <ButtonLink
                href={`/shop/invoices/${order.id}/pdf`}
                variant="outline"
              >
                <FileText className="size-4" aria-hidden />
                View PDF
              </ButtonLink>
              <ButtonLink href={`/shop/invoices/${order.id}/pdf?download`}>
                <Download className="size-4" aria-hidden />
                Download
              </ButtonLink>
            </>
          )}
          {!issued && (
            <ButtonLink
              href={`/shop/orders/${order.id}/edit`}
              variant="outline"
            >
              <Pencil className="size-4" aria-hidden />
              Edit
            </ButtonLink>
          )}
        </div>
      </div>

      <section className="shadow-lift mb-5 overflow-hidden rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Lines on this order</caption>
            <thead>
              <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                <th scope="col" className="w-8 px-3 py-2.5 font-medium">
                  #
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Product
                </th>
                <th scope="col" className="px-2 py-2.5 font-medium">
                  Ref
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  SPH
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  CYL
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  AX
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  ADD
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  Rate
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  Disc
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id} className="border-t border-mist-200">
                  <td className="text-navy-400 px-3 py-2.5 text-xs">
                    {line.line_no}
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {line.product_name}
                  </td>
                  <td className="text-navy-600 px-2 py-2.5 font-mono text-xs">
                    {line.eye ?? ""}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">
                    {formatPower(line.sph)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">
                    {formatPower(line.cyl)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">
                    {line.ax ?? ""}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">
                    {formatPower(line.add_power)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatAmount(line.unit_price)}
                  </td>
                  <td className="text-navy-500 px-2 py-2.5 text-right tabular-nums">
                    {line.discount_pct > 0 ? `${line.discount_pct}%` : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {line.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatAmount(line.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-mist-200 px-5 py-4">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            {issued ? (
              <>
                <Row label="Invoice amount" value={order.invoice_amount} />
                <Row label="Discount" value={order.discount_amount} />
                <Row label="Freight" value={order.freight_charge} />
                <Row label="Net" value={order.net_amount} />
                <Row
                  label={`GST (${order.gst_rate}%)`}
                  value={order.gst_amount}
                />
                <Row
                  label={`Additional tax (${order.additional_tax_rate}%)`}
                  value={order.additional_tax_amount}
                />
                <div className="flex justify-between border-t border-mist-200 pt-2 text-base font-semibold">
                  <dt>Amount (incl. tax)</dt>
                  <dd className="tabular-nums">
                    Rs {formatAmount(order.amount_incl_tax ?? 0)}
                  </dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-base font-semibold">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">Rs {formatAmount(subtotal)}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {!issued && !voided && (
        <div className="space-y-5">
          <StockCheck lines={availability} productLinks={productLinks} />
          <IssuePanel order={order} subtotal={subtotal} />
          <DeleteDraftPanel order={order} />
        </div>
      )}

      {issued && !voided && (
        <div className="space-y-5">
          <DispatchPanel order={order} />
          <VoidPanel order={order} />
        </div>
      )}

      {voided && (
        <p className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset">
          This invoice was voided on {formatDateTime(order.voided_at)}. The
          stock went back to its bins and the customer&rsquo;s account was
          credited. Reason: {order.void_reason ?? "not given"}.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between">
      <dt className="text-navy-500">{label}</dt>
      <dd className="tabular-nums">{formatAmount(value ?? 0)}</dd>
    </div>
  );
}
