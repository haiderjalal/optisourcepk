import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listExpenses } from "@/services/shop/expense.service";
import { ExpenseForm } from "@/features/shop/expenses/ExpenseForm";
import { deleteExpenseAction } from "@/features/shop/expenses/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { inputClass } from "@/components/ui/field";
import { monthSchema } from "@/lib/validations/shop/expense";
import {
  formatAmount,
  formatDate,
  formatPkr,
  todayInKarachi,
} from "@/lib/format";

export const metadata: Metadata = { title: "Expenses" };

const MONTH_NAME = new Intl.DateTimeFormat("en-PK", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ExpensesPage({
  searchParams,
}: PageProps<"/shop/expenses">) {
  await requireUser();

  const today = todayInKarachi();
  const thisMonth = today.slice(0, 7);
  const { month: raw } = await searchParams;
  const parsed = monthSchema.safeParse(raw);
  const month = parsed.success ? parsed.data : thisMonth;

  const expenses = await listExpenses(month);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Same item typed with different capitals is one item.
  const byItem = new Map<
    string,
    { item: string; amount: number; count: number }
  >();
  for (const e of expenses) {
    const k = e.item.trim().toLowerCase();
    const row = byItem.get(k) ?? { item: e.item.trim(), amount: 0, count: 0 };
    row.amount += e.amount;
    row.count += 1;
    byItem.set(k, row);
  }
  const summary = [...byItem.values()].sort((a, b) => b.amount - a.amount);

  const monthLabel = MONTH_NAME.format(new Date(`${month}-01T00:00:00Z`));
  const defaultDate = month === thisMonth ? today : `${month}-01`;
  const monthLink = (m: string) => `/shop/expenses?month=${m}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent-600">Accounts</p>
          <h1 className="mt-2 text-2xl font-bold">Expenses</h1>
          <p className="text-navy-500 mt-2 max-w-prose text-sm">
            Day-to-day running costs — fitting charges, delivery, milk, chai —
            totalled by month.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={monthLink(shiftMonth(month, -1))}
            className="text-navy-600 rounded-lg border border-mist-300 bg-white p-2 transition-colors hover:bg-mist-100"
            title="Previous month"
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">Previous month</span>
          </Link>
          {/* A GET form: the month lives in the URL, so back and refresh work. */}
          <form className="flex items-center gap-2">
            <label htmlFor="month" className="sr-only">
              Month
            </label>
            <input
              id="month"
              name="month"
              type="month"
              defaultValue={month}
              className={`${inputClass} w-auto py-2`}
            />
            <button
              type="submit"
              className="text-navy-600 rounded-lg border border-mist-300 bg-white px-3 py-2 text-sm font-medium transition-colors hover:bg-mist-100"
            >
              Show
            </button>
          </form>
          <Link
            href={monthLink(shiftMonth(month, 1))}
            className="text-navy-600 rounded-lg border border-mist-300 bg-white p-2 transition-colors hover:bg-mist-100"
            title="Next month"
          >
            <ChevronRight className="size-4" aria-hidden />
            <span className="sr-only">Next month</span>
          </Link>
        </div>
      </div>

      <ExpenseForm key={month} defaultDate={defaultDate} />

      <div className="shadow-lift mb-5 flex flex-wrap items-baseline justify-between gap-3 rounded-2xl bg-white p-5">
        <h2 className="text-base font-semibold">{monthLabel}</h2>
        <p className="text-sm">
          <span className="text-navy-500">
            {expenses.length} {expenses.length === 1 ? "entry" : "entries"} ·
            Total{" "}
          </span>
          <span className="text-xl font-bold tabular-nums">
            {formatPkr(total)}
          </span>
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Receipt className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">No expenses for {monthLabel}.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            Add the first one above — an item and what it cost.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="shadow-lift overflow-hidden rounded-2xl bg-white lg:col-span-2">
            <table className="w-full text-sm">
              <caption className="sr-only">Expenses for {monthLabel}</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Item
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Amount (Rs)
                  </th>
                  <th scope="col" className="w-14 px-2 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-mist-200">
                    <td className="text-navy-500 px-4 py-2.5 whitespace-nowrap">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      {expense.item}
                      {expense.note && (
                        <span className="text-navy-400 block text-xs">
                          {expense.note}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatAmount(expense.amount)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <ConfirmButton
                        action={deleteExpenseAction}
                        id={expense.id}
                        name={`${expense.item} on ${formatDate(expense.expense_date)}`}
                        kind="delete"
                        question="Delete?"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="shadow-lift self-start rounded-2xl bg-white p-5">
            <h2 className="text-base font-semibold">By item</h2>
            <ul className="mt-3 divide-y divide-mist-200 text-sm">
              {summary.map((row) => (
                <li
                  key={row.item.toLowerCase()}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    {row.item}
                    <span className="text-navy-400 ml-1.5 text-xs">
                      ×{row.count}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatAmount(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
