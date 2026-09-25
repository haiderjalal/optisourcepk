import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Plus,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listOrders } from "@/services/shop/invoice.service";
import { listOutstanding } from "@/services/shop/ledger.service";
import { listLowStock } from "@/services/shop/stock.service";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/features/shop/orders/StatusBadge";
import { describeBin, formatAmount, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function ShopDashboardPage() {
  // Re-checked here rather than trusted from the layout: a layout's guard does
  // not run for a Server Function invoked from this route.
  await requireUser();

  // Independent reads, so they go together rather than in series.
  const [orders, outstanding, { lines: low, total: lowTotal }] =
    await Promise.all([
      listOrders({ limit: 8 }),
      listOutstanding(),
      listLowStock(),
    ]);

  const receivable = outstanding.reduce((sum, row) => sum + row.balance, 0);
  const openOrders = orders.filter(
    (o) => o.issued_at === null && o.voided_at === null,
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Back office</p>
          <h1 className="mt-2 text-2xl font-bold">Today</h1>
        </div>
        <ButtonLink href="/shop/orders/new" size="lg">
          <Plus className="size-4" aria-hidden />
          New order
        </ButtonLink>
      </div>

      <div className="shadow-lift mb-6 grid gap-px overflow-hidden rounded-2xl bg-mist-200 sm:grid-cols-3">
        <Metric
          label="Receivable"
          value={`Rs ${formatAmount(receivable)}`}
          detail={`${outstanding.length} ${outstanding.length === 1 ? "shop owes" : "shops owe"}`}
          href="/shop/customers"
          icon={Wallet}
          tone={receivable > 0 ? "owing" : undefined}
        />
        <Metric
          label="Open orders"
          value={String(openOrders)}
          detail="not yet invoiced"
          href="/shop/orders"
          icon={ClipboardList}
        />
        <Metric
          label="Running low"
          value={String(lowTotal)}
          detail={
            lowTotal === 1 ? "power at alert level" : "powers at alert level"
          }
          href="/shop/stock"
          icon={TriangleAlert}
          tone={lowTotal > 0 ? "owing" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Recent orders</h2>
            <Link
              href="/shop/orders"
              className="text-accent-600 hover:text-accent-700 inline-flex items-center gap-1 text-sm font-medium"
            >
              All orders
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          {orders.length === 0 ? (
            <Empty
              icon={ClipboardList}
              title="No orders yet"
              body="Build an order line by line, then issue the invoice."
              cta={{ href: "/shop/orders/new", label: "Create an order" }}
            />
          ) : (
            <ul className="shadow-lift divide-y divide-mist-200 overflow-hidden rounded-2xl bg-white">
              {orders.slice(0, 6).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/shop/orders/${order.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-mist-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {order.bill_to_shop ?? `Order ${order.order_no}`}
                      </p>
                      <p className="text-navy-400 text-xs">
                        {order.invoice_no
                          ? `Invoice ${order.invoice_no}`
                          : `Order ${order.order_no}`}{" "}
                        · {formatDate(order.issued_at ?? order.created_at)}
                      </p>
                    </div>
                    <StatusBadge order={order} />
                    <span className="w-24 text-right text-sm font-medium tabular-nums">
                      {order.amount_incl_tax === null
                        ? "—"
                        : formatAmount(order.amount_incl_tax)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Owes the most</h2>
            <Link
              href="/shop/payments"
              className="text-accent-600 hover:text-accent-700 inline-flex items-center gap-1 text-sm font-medium"
            >
              Record payment
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          {outstanding.length === 0 ? (
            <Empty
              icon={Users}
              title="Nothing outstanding"
              body="Every shop is settled up. Balances appear here as invoices are issued."
            />
          ) : (
            <ul className="shadow-lift divide-y divide-mist-200 overflow-hidden rounded-2xl bg-white">
              {outstanding.slice(0, 6).map((row) => (
                <li key={row.customer_id}>
                  <Link
                    href={`/shop/customers/${row.customer_id}/statement`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-mist-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.shop_name}
                      </p>
                      <p className="text-navy-400 text-xs">{row.area}</p>
                    </div>
                    <span className="text-sm font-semibold text-amber-700 tabular-nums">
                      Rs {formatAmount(row.balance)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {low.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Running low</h2>
            <Link
              href="/shop/stock"
              className="text-accent-600 hover:text-accent-700 inline-flex items-center gap-1 text-sm font-medium"
            >
              All stock
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {low.map((line) => (
              <li
                key={
                  line.bin_id ?? `${line.product_id}|${line.sph}|${line.cyl}`
                }
              >
                <Link
                  href={`/shop/products/${line.product_id}`}
                  className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs ring-1 ring-amber-200 transition-colors ring-inset hover:bg-amber-100"
                >
                  <span className="font-medium text-amber-900">
                    {line.name}
                  </span>
                  <span className="font-mono text-amber-700">
                    {describeBin(line)}
                  </span>
                  <span className="font-semibold text-amber-900 tabular-nums">
                    {line.qty_on_hand}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "owing";
}) {
  return (
    <Link
      href={href}
      className="bg-white p-5 transition-colors hover:bg-mist-50"
    >
      <div className="flex items-center gap-2">
        <Icon className="text-navy-300 size-4" aria-hidden />
        <p className="text-navy-500 text-xs font-medium">{label}</p>
      </div>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${
          tone === "owing" ? "text-amber-700" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-navy-400 mt-0.5 text-xs">{detail}</p>
    </Link>
  );
}

function Empty({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-10 text-center">
      <Icon className="text-navy-300 mx-auto size-7" aria-hidden />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="text-navy-500 mx-auto mt-1.5 max-w-xs text-sm">{body}</p>
      {cta && (
        <ButtonLink
          href={cta.href}
          variant="outline"
          size="sm"
          className="mt-4"
        >
          {cta.label}
        </ButtonLink>
      )}
    </div>
  );
}
