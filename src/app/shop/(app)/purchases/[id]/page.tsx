import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/shop/dal";
import { getPurchase } from "@/services/shop/purchase.service";
import { describeBin, formatAmount, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Purchase invoice" };

export default async function PurchasePage({
  params,
}: PageProps<"/shop/purchases/[id]">) {
  await requireUser();
  const { id } = await params;

  const purchase = await getPurchase(id);
  if (!purchase) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/shop/purchases"
        className="text-navy-500 hover:text-navy-700 mb-5 inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Purchases
      </Link>

      <div className="mb-6">
        <p className="eyebrow text-accent-600">Purchase invoice</p>
        <h1 className="mt-2 text-2xl font-bold">{purchase.invoice_no}</h1>
        <p className="text-navy-500 mt-1 text-sm">
          <Link
            href={`/shop/suppliers/${purchase.supplier_id}`}
            className="hover:text-accent-600 font-medium"
          >
            {purchase.supplier_name}
          </Link>{" "}
          · {formatDate(purchase.invoice_date)}
          {purchase.notes ? ` · ${purchase.notes}` : ""}
        </p>
      </div>

      <div className="shadow-lift overflow-x-auto rounded-2xl bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Lines on this purchase invoice</caption>
          <thead>
            <tr className="text-navy-500 bg-mist-100 text-left">
              <th scope="col" className="w-10 px-4 py-3 font-medium">
                #
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Product
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Power
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Unit cost
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {purchase.lines.map((line, index) => (
              <tr key={line.id} className="border-t border-mist-200">
                <td className="text-navy-400 px-4 py-2.5 text-xs">
                  {index + 1}
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/shop/products/${line.product_id}`}
                    className="hover:text-accent-600"
                  >
                    {line.product_name}
                  </Link>
                </td>
                <td className="text-navy-600 px-4 py-2.5 font-mono text-xs">
                  {describeBin(line)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {line.quantity}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatAmount(line.unit_cost)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatAmount(line.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-mist-300 bg-mist-50">
              <th
                scope="row"
                colSpan={3}
                className="px-4 py-3 text-left font-medium"
              >
                {purchase.line_count}{" "}
                {purchase.line_count === 1 ? "line" : "lines"}
              </th>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {purchase.total_qty}
              </td>
              <td />
              <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">
                Rs {formatAmount(purchase.total_amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-navy-400 mt-3 text-xs">
        Purchases are kept as entered. To correct stock, use a stock adjustment
        on the product page.
      </p>
    </div>
  );
}
