"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmount, formatPower } from "@/lib/format";
import type { Order, OrderLine, Product } from "@/types/database";
import {
  saveRxInvoiceStockAction,
  type OrderFormState,
} from "../orders/actions";
import {
  StockItemRows,
  firstStockProblem,
  stockItemLines,
  stockRowsFrom,
  type StockRowDraft,
} from "./StockItemRows";

/**
 * A reopened combined RX invoice: its lens lines are shown as they are, and its
 * stock items can be changed. Freight and tax are set when it is issued again.
 */

function SaveButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending || !ready}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : "Save stock items"}
    </Button>
  );
}

export function RxInvoiceStockForm({
  invoice,
  lines,
  stockProducts,
}: {
  invoice: Order;
  lines: OrderLine[];
  /** Shelf products that can be added as stock items. */
  stockProducts: Product[];
}) {
  const [state, formAction] = useActionState<OrderFormState, FormData>(
    saveRxInvoiceStockAction,
    {},
  );
  const lensLines = lines.filter((line) => line.rx_status !== null);
  const [stockRows, setStockRows] = useState<StockRowDraft[]>(() =>
    stockRowsFrom(lines),
  );
  const stockProblem = firstStockProblem(stockRows, stockProducts);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={invoice.id} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(stockItemLines(stockRows, "0"))}
      />

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">Lens lines</h2>
        <p className="text-navy-500 mt-1 text-xs">
          Kept as they are. Their lab status and prices are not changed here.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Lens lines on this invoice</caption>
            <thead>
              <tr className="text-navy-600 bg-mist-100 text-left text-xs">
                <th scope="col" className="px-3 py-2 font-medium">
                  Lens
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Eye
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Sphere
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Cyl
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Axis
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Add
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Rate
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {lensLines.map((line) => (
                <tr key={line.id} className="border-t border-mist-200">
                  <td className="px-3 py-2">{line.product_name}</td>
                  <td className="px-3 py-2">{line.eye ?? ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPower(line.sph)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPower(line.cyl)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {line.ax ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPower(line.add_power)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {line.quantity}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAmount(line.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatAmount(line.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">Stock items</h2>
        <p className="text-navy-500 mt-1 text-xs">
          Shelf items billed on this invoice. They come off the shelf when the
          invoice is issued again.
        </p>
        <StockItemRows
          rows={stockRows}
          onChange={setStockRows}
          stockProducts={stockProducts}
          fallbackDiscount="0"
        />
      </section>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton ready={stockProblem === null} />
        <Link
          href={`/shop/orders/${invoice.id}`}
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
        <span className="text-navy-400 text-xs">
          {stockProblem ??
            "Freight and tax are set when you issue the invoice again."}
        </span>
      </div>
    </form>
  );
}
