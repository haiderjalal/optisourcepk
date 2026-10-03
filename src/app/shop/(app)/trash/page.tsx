import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { listRecentlyDeleted, TRASH_DAYS } from "@/services/shop/trash.service";
import { RestoreButton } from "@/features/shop/trash/RestoreButton";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Recently deleted" };

export default async function RecentlyDeletedPage() {
  await requireUser();
  const { items, ready } = await listRecentlyDeleted();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="eyebrow text-accent-600">Records</p>
        <h1 className="mt-2 text-2xl font-bold">Recently deleted</h1>
        <p className="text-navy-500 mt-2 max-w-prose text-sm">
          Orders, invoices, stock entries and expenses you delete wait here for{" "}
          {TRASH_DAYS} days. Restore puts them back exactly as they were — an
          invoice keeps its number, and its stock and account entries come back
          with it. After {TRASH_DAYS} days they are removed for good.
        </p>
      </div>

      {!ready ? (
        <div
          role="alert"
          className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset"
        >
          <p className="font-semibold">
            Recently deleted is not set up in the database yet.
          </p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0032_recently_deleted.sql
            </code>{" "}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-white/60 px-6 py-16 text-center">
          <Trash2 className="text-navy-300 mx-auto size-8" aria-hidden />
          <h2 className="mt-4 font-semibold">Nothing deleted recently.</h2>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            Anything you delete in the next {TRASH_DAYS} days can be restored
            from here.
          </p>
        </div>
      ) : (
        <section className="shadow-lift overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Recently deleted items</caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left text-xs">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    What
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Deleted
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Gone for good
                  </th>
                  <th scope="col" className="px-5 py-2.5">
                    <span className="sr-only">Restore</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.key}
                    className="border-t border-mist-200 align-top"
                  >
                    <td className="px-5 py-3">
                      <span className="text-navy-500 block text-xs">
                        {item.kind}
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </td>
                    <td className="text-navy-600 px-3 py-3 whitespace-nowrap">
                      {formatDateTime(item.deletedAt)}
                    </td>
                    <td
                      className={`px-3 py-3 whitespace-nowrap ${item.daysLeft <= 1 ? "font-medium text-amber-700" : "text-navy-600"}`}
                    >
                      {item.daysLeft === 0
                        ? "Today"
                        : `In ${item.daysLeft} ${item.daysLeft === 1 ? "day" : "days"}`}
                    </td>
                    <td className="px-5 py-2.5">
                      <RestoreButton
                        id={item.id}
                        source={item.source}
                        label={item.label}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
