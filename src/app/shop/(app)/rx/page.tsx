import type { Metadata } from "next";
import Link from "next/link";
import { Glasses, Plus, Search } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import {
  listRxJobs,
  listRxMonthly,
  RX_LIMIT,
  type RxJob,
  type RxSearch,
} from "@/services/shop/rx.service";
import { RxStageControl } from "@/features/shop/rx/RxStageControl";
import { RxInvoiceForm } from "@/features/shop/rx/RxInvoiceForm";
import { ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { formatAmount, formatPkr, formatPower, formatRxNo } from "@/lib/format";

export const metadata: Metadata = { title: "RX orders" };

const MONTH_NAME = new Intl.DateTimeFormat("en-PK", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const STATUSES = [
  { value: "ordered", label: "Not back yet" },
  { value: "received", label: "Received" },
  { value: "all", label: "All" },
] as const;

/** A dioptre from the URL: a quarter step, or ignored. */
function dioptre(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > 30) return null;
  return Math.round(value * 4) / 4 === value ? value : null;
}

/** An RX number as typed: RX006, RX-0006, rx 6 and 6 all mean 6. */
function rxNumber(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export default async function RxOrdersPage({
  searchParams,
}: PageProps<"/shop/rx">) {
  await requireUser();

  const params = await searchParams;
  const status = STATUSES.some((s) => s.value === params.status)
    ? (params.status as RxSearch["status"])
    : "ordered";
  const search: RxSearch = {
    sph: dioptre(params.sph),
    cyl: dioptre(params.cyl),
    add: dioptre(params.add),
    shop:
      typeof params.shop === "string" ? params.shop.trim().slice(0, 80) : "",
    rxNo: rxNumber(params.rx),
    status,
  };

  const [jobs, months] = await Promise.all([
    listRxJobs(search),
    listRxMonthly(),
  ]);

  const searching =
    search.sph !== null ||
    search.cyl !== null ||
    search.add !== null ||
    search.shop !== "" ||
    search.rxNo !== null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Trade</p>
          <h1 className="mt-2 text-2xl font-bold">RX orders</h1>
          <p className="text-navy-500 mt-2 max-w-prose text-sm">
            Lenses ordered from a lab for one job. When a lens comes back,
            search its power to see which shop it is for, then mark it received.
          </p>
        </div>
        <ButtonLink href="/shop/rx/new" size="lg">
          <Plus className="size-4" aria-hidden />
          New RX order
        </ButtonLink>
      </div>

      {/* A GET form: the search lives in the URL, so back and refresh work. */}
      <form className="shadow-lift mb-5 grid gap-3 rounded-2xl bg-white p-5 sm:grid-cols-4 lg:grid-cols-7">
        <label className="text-sm">
          <span className="text-navy-600 mb-1 block font-medium">RX no.</span>
          <input
            name="rx"
            type="search"
            defaultValue={search.rxNo === null ? "" : formatRxNo(search.rxNo)}
            placeholder="RX006"
            className={inputClass}
          />
        </label>
        {(
          [
            ["sph", "SPH", search.sph],
            ["cyl", "CYL", search.cyl],
            ["add", "ADD", search.add],
          ] as const
        ).map(([name, label, value]) => (
          <label key={name} className="text-sm">
            <span className="text-navy-600 mb-1 block font-medium">
              {label}
            </span>
            <input
              name={name}
              type="number"
              step="0.25"
              inputMode="decimal"
              defaultValue={value ?? ""}
              className={inputClass}
            />
          </label>
        ))}
        <label className="text-sm">
          <span className="text-navy-600 mb-1 block font-medium">
            Shop or patient
          </span>
          <input
            name="shop"
            type="search"
            defaultValue={search.shop}
            placeholder="Name"
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="text-navy-600 mb-1 block font-medium">Status</span>
          <select name="status" defaultValue={status} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="bg-accent-600 hover:bg-accent-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors"
          >
            <Search className="size-4" aria-hidden />
            Search
          </button>
          {searching && (
            <Link
              href={`/shop/rx?status=${status}`}
              className="text-navy-500 hover:text-navy-700 text-sm font-medium"
            >
              Clear
            </Link>
          )}
        </div>
        <p className="text-navy-400 text-xs sm:col-span-4 lg:col-span-7">
          Enter 0 in CYL or ADD to find lenses with none. Leave a box blank to
          match any value.
        </p>
      </form>

      {jobs.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-14 text-center">
          <Glasses className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">
            {searching ? "No RX job matches that search." : "No RX jobs here."}
          </h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            {searching
              ? "Check the power, or set Status to All to include received lenses."
              : "Start one with New RX order. Its lenses appear here until they come back from the lab."}
          </p>
        </div>
      ) : (
        <section className="shadow-lift mb-8 overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">RX jobs</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Patient / shop
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    RX no.
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Eye
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2.5 text-right font-medium"
                  >
                    SPH
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2.5 text-right font-medium"
                  >
                    CYL
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2.5 text-right font-medium"
                  >
                    AX
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2.5 text-right font-medium"
                  >
                    ADD
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Lab
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Cost / Sale
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((pair) => {
                  const job = pair[0];

                  return (
                    <tr
                      key={pair.map((l) => l.id).join("+")}
                      className="border-t border-mist-200 align-top"
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-medium">
                          {job.patientName ?? "—"}
                        </span>
                        <span className="text-navy-400 block text-xs">
                          {job.shopName}
                          {job.area && ` · ${job.area}`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Link
                          href={`/shop/orders/${job.orderId}`}
                          className="text-accent-700 font-medium hover:underline"
                        >
                          {formatRxNo(job.rxNo)}
                        </Link>
                        <span className="text-navy-400 block text-xs">
                          {job.voided
                            ? "void"
                            : job.invoiceNo
                              ? `Invoice ${job.invoiceNo}${job.orderStatus === "delivered" ? " · delivered" : ""}`
                              : "not invoiced"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{job.product_name}</td>
                      <Stack
                        pair={pair}
                        align="left"
                        value={(l) =>
                          `${l.eye ?? "—"}${l.quantity > 1 ? ` ×${l.quantity}` : ""}`
                        }
                      />
                      <Stack pair={pair} value={(l) => formatPower(l.sph)} />
                      <Stack pair={pair} value={(l) => formatPower(l.cyl)} />
                      <Stack pair={pair} value={(l) => String(l.ax ?? "")} />
                      <Stack
                        pair={pair}
                        value={(l) => formatPower(l.add_power)}
                      />
                      <td className="text-navy-600 px-3 py-2.5">
                        {[
                          ...new Set(pair.map((l) => l.supplierName ?? "—")),
                        ].join(", ")}
                      </td>
                      <Stack
                        pair={pair}
                        mono={false}
                        value={(l) =>
                          `${l.unit_cost === null ? "—" : formatAmount(l.unit_cost)} / ${l.unit_price > 0 ? formatAmount(l.unit_price) : "—"}`
                        }
                      />
                      <td className="px-4 py-2 text-right">
                        {job.rxStage && (
                          <RxStageControl
                            orderId={job.orderId}
                            stage={job.rxStage}
                            sentAt={job.rxSentAt}
                            backAt={job.rxBackAt}
                            final={job.invoiceNo !== null || job.voided}
                            compact
                          />
                        )}
                        {job.invoiceNo === null && !job.voided && (
                          <RxInvoiceForm
                            orderId={job.orderId}
                            salePrice={job.unit_price}
                            purchasePrice={job.unit_cost}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {jobs.flat().length >= RX_LIMIT && (
            <p className="text-navy-500 border-t border-mist-200 px-5 py-3 text-xs">
              Showing the latest {RX_LIMIT}. Search by power or shop to narrow
              it down.
            </p>
          )}
        </section>
      )}

      <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
        <div className="border-b border-mist-200 px-5 py-4">
          <h2 className="text-base font-semibold">RX sales by month</h2>
          <p className="text-navy-500 mt-1 text-xs">
            Issued invoices only, voids excluded. Sales are line totals after
            discount, before freight and tax.
          </p>
        </div>
        {months.length === 0 ? (
          <p className="text-navy-500 px-5 py-6 text-sm">
            No RX invoices issued yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">RX sales, cost and profit</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Month
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Lenses
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Sales
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Cost
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-right font-medium"
                  >
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-t border-mist-200">
                    <td className="px-5 py-2.5 font-medium">
                      {MONTH_NAME.format(new Date(`${m.month}T00:00:00Z`))}
                      {m.missing_cost > 0 && (
                        <span className="block text-xs font-normal text-amber-700">
                          {m.missing_cost}{" "}
                          {m.missing_cost === 1 ? "line has" : "lines have"} no
                          purchase price
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {m.lenses}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(m.sales)}
                    </td>
                    <td className="text-navy-500 px-3 py-2.5 text-right tabular-nums">
                      {formatAmount(m.cost)}
                    </td>
                    <td
                      className={`px-5 py-2.5 text-right font-semibold tabular-nums ${m.profit < 0 ? "text-amber-700" : ""}`}
                    >
                      {formatPkr(m.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** One cell showing each eye of a pair on its own line, R above L. */
function Stack({
  pair,
  value,
  align = "right",
  mono = true,
}: {
  pair: RxJob[];
  value: (line: RxJob) => string;
  align?: "left" | "right";
  mono?: boolean;
}) {
  return (
    <td
      className={`px-2 py-2.5 tabular-nums ${align === "right" ? "text-right" : ""} ${mono ? "font-mono text-xs" : "text-sm whitespace-nowrap"}`}
    >
      {pair.map((line) => (
        <span key={line.id} className="block leading-6">
          {value(line)}
        </span>
      ))}
    </td>
  );
}
