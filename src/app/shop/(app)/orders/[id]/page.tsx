import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, Pencil } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getOrder } from "@/services/shop/invoice.service";
import { checkOrderStock } from "@/services/shop/stock.service";
import { getBalance } from "@/services/shop/ledger.service";
import { StockCheck } from "@/features/shop/orders/StockCheck";
import { DeleteDraftPanel } from "@/features/shop/orders/DeleteDraftPanel";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/features/shop/orders/StatusBadge";
import {
  DispatchPanel,
  IssuePanel,
  VoidPanel,
} from "@/features/shop/orders/InvoiceActions";
import { RxStageControl } from "@/features/shop/rx/RxStageControl";
import { RxWhatsAppButtons } from "@/features/shop/rx/RxWhatsAppButtons";
import { getSupplier } from "@/services/shop/supplier.service";
import {
  formatAmount,
  formatDateTime,
  formatPower,
  formatRxNo,
} from "@/lib/format";

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
  // A draft shows the account as it stands now; an issued invoice shows the
  // figures frozen when it went out.
  const [availability, account] = canIssue
    ? await Promise.all([
        // An RX order is made by a lab; there is no stock to check.
        order.is_rx ? [] : checkOrderStock(id),
        getBalance(order.bill_to_customer_id),
      ])
    : [[], null];

  // The lab an RX job went to, for its WhatsApp number.
  const labId = order.is_rx
    ? (order.lines.find((l) => l.supplier_id)?.supplier_id ?? null)
    : null;
  const lab = labId ? await getSupplier(labId) : null;

  const issued = order.issued_at !== null;
  const voided = order.voided_at !== null;
  const subtotal = order.lines.reduce((sum, line) => sum + line.line_total, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={order.is_rx ? "/shop/rx" : "/shop/orders"}
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {order.is_rx ? "RX orders" : "Orders"}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold">
              {issued
                ? `Invoice ${order.invoice_no}`
                : order.is_rx
                  ? formatRxNo(order.rx_no)
                  : `Order ${order.order_no}`}
            </h1>
            <StatusBadge order={order} />
            {order.is_rx && (
              <span className="bg-accent-50 text-accent-700 ring-accent-200 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset">
                {issued ? formatRxNo(order.rx_no) : "RX"}
              </span>
            )}
          </div>
          <p className="text-navy-500 mt-1.5 text-sm">
            {order.is_rx && order.patient_name && (
              <span className="text-navy-800 font-medium">
                {order.patient_name} ·{" "}
              </span>
            )}
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

      {order.is_rx && order.rx_stage && (
        <section className="shadow-lift mb-5 rounded-2xl bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Lab</h2>
            <RxStageControl
              orderId={order.id}
              stage={order.rx_stage}
              sentAt={order.rx_sent_at}
              backAt={order.rx_back_at}
              final={issued || voided}
            />
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <RxDetail
              label="Lens type"
              value={order.rx_lens_type?.toUpperCase() ?? null}
            />
            <RxDetail
              label="Frame"
              value={
                [order.frame_material, order.frame_type]
                  .filter(Boolean)
                  .map((v) => String(v).replace(/^./, (c) => c.toUpperCase()))
                  .join(", ") || null
              }
            />
            <RxDetail
              label="Tint / photochromatic / antiglare"
              value={order.rx_tint_reason}
            />
          </dl>
          <RxWhatsAppButtons
            order={order}
            lines={order.lines}
            shopName={
              order.customer?.shop_name ?? order.bill_to_shop ?? "the shop"
            }
            shopPhone={order.customer?.phone ?? order.bill_to_phone ?? null}
            lab={lab}
          />
        </section>
      )}

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
                {order.previous_balance !== null && (
                  <AccountRows
                    previous={order.previous_balance}
                    payable={order.closing_balance ?? 0}
                  />
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between text-base font-semibold">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">Rs {formatAmount(subtotal)}</dd>
                </div>
                {account && (
                  <AccountRows
                    previous={account.balance}
                    payable={account.balance + subtotal}
                    note="Freight and tax are added when you issue."
                  />
                )}
              </>
            )}
          </dl>
        </div>
      </section>

      {!issued && !voided && (
        <div className="space-y-5">
          <StockCheck lines={availability} />
          {order.is_rx && order.rx_stage !== "back" ? (
            <p className="text-navy-600 rounded-2xl border border-dashed border-mist-300 bg-white/60 px-5 py-4 text-sm">
              The invoice can be issued once the lens is back from the lab. Mark
              it back from the lab above, check the prices with Edit, then
              issue.
            </p>
          ) : (
            <IssuePanel order={order} subtotal={subtotal} />
          )}
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

/** What the shop owed before this invoice, and what it owes with it. */
function AccountRows({
  previous,
  payable,
  note,
}: {
  previous: number;
  payable: number;
  note?: string;
}) {
  return (
    <>
      <div className="mt-3 flex justify-between border-t border-mist-200 pt-3">
        <dt className="text-navy-500">Previous balance</dt>
        <dd className="tabular-nums">{formatAmount(previous)}</dd>
      </div>
      <div className="flex justify-between text-base font-semibold">
        <dt>Total payable</dt>
        <dd className="tabular-nums">Rs {formatAmount(payable)}</dd>
      </div>
      {note && (
        <div className="text-navy-500 text-xs">
          <dt className="sr-only">Note</dt>
          <dd>{note}</dd>
        </div>
      )}
    </>
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

function RxDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-navy-500 text-xs">{label}</dt>
      <dd className="mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
