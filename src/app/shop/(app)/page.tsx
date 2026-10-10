import { Suspense, cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Plus,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listOrders } from "@/services/shop/invoice.service";
import { getCustomerShopNames } from "@/services/shop/customer.service";
import { listOutstanding } from "@/services/shop/ledger.service";
import { listLowStock } from "@/services/shop/stock.service";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/features/shop/orders/StatusBadge";
import { ShopPageHeader } from "@/features/shop/layout/ShopPageHeader";
import {
  describeBin,
  formatAmount,
  formatDate,
  formatPkr,
  todayInKarachi,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const RECENT_ORDERS = 6;
const OWING_SHOPS = 6;

export default async function ShopDashboardPage() {
  // Re-checked here rather than trusted from the layout: a layout's guard does
  // not run for a Server Function invoked from this route.
  await requireUser();

  // Independent reads, so they go together rather than in series.
  // Running-low stock is streamed in below rather than awaited here: it is the
  // slowest figure on the page, and the rest should not wait for it.
  const [orders, outstanding] = await Promise.all([
    listOrders({ limit: RECENT_ORDERS }),
    listOutstanding(),
  ]);
  // Drafts carry no shop name until invoiced, so the live name is looked up.
  const shopById = await getCustomerShopNames(
    orders.map((order) => order.bill_to_customer_id),
  );

  const receivable = outstanding.reduce((sum, row) => sum + row.balance, 0);
  const openOrders = orders.filter(
    (o) => o.issued_at === null && o.voided_at === null,
  ).length;

  return (
    <div className="mx-auto max-w-6xl">
      <ShopPageHeader
        eyebrow={`Back office · ${formatDate(todayInKarachi())}`}
        title="Today"
      />

      <section
        aria-label="Quick actions"
        className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <QuickAction
          href="/shop/orders/new"
          icon={Plus}
          label="New order"
          detail="Start a saved order"
          primary
        />
        <QuickAction
          href="/shop/payments"
          icon={Wallet}
          label="Record payment"
          detail="Money received"
        />
        <QuickAction
          href="/shop/customers"
          icon={Users}
          label="Shops"
          detail="Find a ledger"
        />
        <QuickAction
          href="/shop/invoices"
          icon={FileText}
          label="Invoices"
          detail="Search and send PDFs"
        />
      </section>

      <section
        aria-label="Key figures"
        className="shadow-lift mb-8 grid gap-px overflow-hidden rounded-2xl bg-mist-200 sm:grid-cols-3"
      >
        <Metric
          label="Owed to you"
          value={formatPkr(receivable)}
          detail={`${outstanding.length} ${outstanding.length === 1 ? "shop owes" : "shops owe"}`}
          href="/shop/customers"
          icon={Wallet}
          tone={receivable > 0 ? "owing" : undefined}
        />
        <Metric
          label="Open orders"
          value={String(openOrders)}
          detail="saved, not yet invoiced"
          href="/shop/orders"
          icon={ClipboardList}
        />
        <Suspense fallback={<MetricPlaceholder label="Running low" />}>
          <LowStockMetric />
        </Suspense>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="owing-heading" className="min-w-0">
          <SectionHead
            id="owing-heading"
            title="Owes the most"
            href="/shop/customers"
            linkLabel="All shops"
          />
          {outstanding.length === 0 ? (
            <Empty
              icon={Users}
              title="Nothing outstanding"
              body="Every shop is settled up. Balances appear here as invoices are issued."
            />
          ) : (
            <ul className="shadow-lift divide-y divide-mist-200 overflow-hidden rounded-2xl bg-white">
              {outstanding.slice(0, OWING_SHOPS).map((row) => (
                <li
                  key={row.customer_id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Link
                    href={`/shop/customers/${row.customer_id}/statement`}
                    className="group min-w-0 flex-1"
                  >
                    <p className="group-hover:text-accent-700 truncate text-sm font-medium">
                      {row.shop_name}
                    </p>
                    <p className="text-navy-400 truncate text-xs">
                      {row.customer_name} · {row.area}
                    </p>
                  </Link>
                  <span className="text-sm font-semibold text-amber-700 tabular-nums">
                    {formatPkr(row.balance)}
                  </span>
                  <ButtonLink
                    href={`/shop/payments?customer=${row.customer_id}`}
                    size="sm"
                    aria-label={`Collect payment from ${row.shop_name}`}
                  >
                    <Wallet className="size-3.5" aria-hidden />
                    Collect
                  </ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-heading" className="min-w-0">
          <SectionHead
            id="recent-heading"
            title="Recent orders"
            href="/shop/orders"
            linkLabel="All orders"
          />
          {orders.length === 0 ? (
            <Empty
              icon={ClipboardList}
              title="No orders yet"
              body="Build an order line by line, then issue the invoice."
              cta={{ href: "/shop/orders/new", label: "Create an order" }}
            />
          ) : (
            <ul className="shadow-lift divide-y divide-mist-200 overflow-hidden rounded-2xl bg-white">
              {orders.map((order) => {
                const shop =
                  order.bill_to_shop ??
                  shopById.get(order.bill_to_customer_id) ??
                  "Shop not set";
                const number = order.invoice_no
                  ? `Invoice ${order.invoice_no}`
                  : order.reserved_invoice_no
                    ? `Invoice ${order.reserved_invoice_no} · editing`
                    : `Order ${order.order_no}`;

                return (
                  <li key={order.id}>
                    <Link
                      href={`/shop/orders/${order.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-mist-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{shop}</p>
                        <p className="text-navy-400 truncate text-xs">
                          {number} ·{" "}
                          {formatDate(order.issued_at ?? order.created_at)}
                        </p>
                      </div>
                      <StatusBadge order={order} />
                      <span
                        className={cn(
                          "w-24 text-right text-sm font-medium tabular-nums",
                          order.amount_incl_tax === null && "text-navy-300",
                        )}
                      >
                        {order.amount_incl_tax === null
                          ? "—"
                          : formatAmount(order.amount_incl_tax)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Suspense fallback={null}>
        <LowStockSection />
      </Suspense>
    </div>
  );
}

/**
 * The low-stock read, shared by the figure and the list below it. `cache`
 * makes the two components' calls one database round trip, not two.
 */
const readLowStock = cache(() => listLowStock());

async function LowStockMetric() {
  const { total } = await readLowStock();
  return (
    <Metric
      label="Running low"
      value={String(total)}
      detail={total === 1 ? "power at alert level" : "powers at alert level"}
      href="/shop/stock"
      icon={TriangleAlert}
      tone={total > 0 ? "owing" : undefined}
    />
  );
}

async function LowStockSection() {
  const { lines: low } = await readLowStock();
  if (low.length === 0) return null;

  return (
    <section aria-labelledby="low-heading" className="mt-8 min-w-0">
      <SectionHead
        id="low-heading"
        title="Running low"
        href="/shop/stock"
        linkLabel="All stock"
      />
      <ul className="flex flex-wrap gap-2">
        {low.map((line) => (
          <li key={line.bin_id ?? `${line.product_id}|${line.sph}|${line.cyl}`}>
            <Link
              href={`/shop/products/${line.product_id}`}
              className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs ring-1 ring-amber-200 transition-colors ring-inset hover:bg-amber-100"
            >
              <span className="font-medium text-amber-900">{line.name}</span>
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
  );
}

/** Holds the figure's place while the stock count loads, so nothing shifts. */
function MetricPlaceholder({ label }: { label: string }) {
  return (
    <div className="bg-white p-5" aria-busy="true">
      <p className="text-navy-500 text-xs font-medium">{label}</p>
      <div className="mt-3 h-7 w-16 animate-pulse rounded-md bg-mist-200" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-mist-100" />
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  detail,
  primary,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5",
        primary
          ? "bg-navy-700 hover:bg-navy-600 text-white shadow-[0_12px_28px_-12px_rgb(15_39_65/0.7)]"
          : "shadow-lift bg-white hover:bg-mist-50",
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-xl",
          primary ? "bg-white/15" : "bg-accent-600/10 text-accent-700",
        )}
      >
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span
          className={cn(
            "mt-0.5 block text-xs",
            primary ? "text-silver-300" : "text-navy-400",
          )}
        >
          {detail}
        </span>
      </span>
    </Link>
  );
}

function SectionHead({
  id,
  title,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      <Link
        href={href}
        className="text-accent-600 hover:text-accent-700 inline-flex items-center gap-1 text-sm font-medium"
      >
        {linkLabel}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
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
  icon: LucideIcon;
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
        className={cn(
          "mt-2 text-2xl font-bold tracking-tight tabular-nums",
          tone === "owing" && "text-amber-700",
        )}
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
  icon: LucideIcon;
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
