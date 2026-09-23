import Link from "next/link";
import { formatAmount, formatDate } from "@/lib/format";
import type { PurchaseInvoiceSummary } from "@/types/database";

/** Purchase invoices as a table. Rendered on the server; no interactivity. */
export function PurchaseTable({
  purchases,
  showSupplier = true,
}: {
  purchases: PurchaseInvoiceSummary[];
  showSupplier?: boolean;
}) {
  return (
    <div className="shadow-lift overflow-x-auto rounded-2xl bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">Purchase invoices</caption>
        <thead>
          <tr className="text-navy-500 bg-mist-100 text-left">
            <th scope="col" className="px-4 py-3 font-medium">
              Invoice
            </th>
            {showSupplier && (
              <th scope="col" className="px-4 py-3 font-medium">
                Supplier
              </th>
            )}
            <th
              scope="col"
              className="hidden px-4 py-3 font-medium sm:table-cell"
            >
              Date
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Qty
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Amount (Rs)
            </th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase) => (
            <tr
              key={purchase.id}
              className="border-t border-mist-200 hover:bg-mist-50"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/shop/purchases/${purchase.id}`}
                  className="hover:text-accent-600 font-medium"
                >
                  {purchase.invoice_no}
                </Link>
                <span className="text-navy-400 block text-xs sm:hidden">
                  {formatDate(purchase.invoice_date)}
                </span>
              </td>
              {showSupplier && (
                <td className="text-navy-600 px-4 py-3">
                  {purchase.supplier_name}
                </td>
              )}
              <td className="text-navy-500 hidden px-4 py-3 sm:table-cell">
                {formatDate(purchase.invoice_date)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {purchase.total_qty}
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatAmount(purchase.total_amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
