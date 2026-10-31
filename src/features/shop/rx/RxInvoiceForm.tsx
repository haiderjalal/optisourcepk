"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order, OrderLine, Product } from "@/types/database";
import { saveRxInvoiceAction, type OrderFormState } from "../orders/actions";
import {
  LensRows,
  firstLensProblem,
  lensPayload,
  lensRowsFrom,
  patientsFrom,
  type LensDraft,
  type PatientDrafts,
} from "./LensRows";
import {
  StockItemRows,
  firstStockProblem,
  stockItemLines,
  stockRowsFrom,
  type StockRowDraft,
} from "./StockItemRows";

/**
 * A reopened combined RX invoice: its lenses and its stock items can be changed.
 * A lens's patient, power, quantity, discount and sale price change here, and the
 * RX order it came from is changed to match. Freight and tax are set when the
 * invoice is issued again.
 */

function SaveButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending || !ready}>
      <Save className="size-4" aria-hidden />
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function RxInvoiceForm({
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
    saveRxInvoiceAction,
    {},
  );
  const [lensRows, setLensRows] = useState<LensDraft[]>(() =>
    lensRowsFrom(lines),
  );
  const [patients, setPatients] = useState<PatientDrafts>(() =>
    patientsFrom(lines),
  );
  const [stockRows, setStockRows] = useState<StockRowDraft[]>(() =>
    stockRowsFrom(lines),
  );
  const problem =
    firstLensProblem(lensRows) ?? firstStockProblem(stockRows, stockProducts);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={invoice.id} />
      <input
        type="hidden"
        name="lenses"
        value={JSON.stringify(lensPayload(lensRows, patients))}
      />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(stockItemLines(stockRows, "0"))}
      />

      <section className="shadow-lift rounded-2xl bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">Lenses</h2>
        <p className="text-navy-500 mt-1 text-xs">
          Change a patient, power, quantity, discount or sale price. The RX
          order each lens came from is changed to match. Lab status and lab
          prices stay as they are.
        </p>
        <LensRows
          rows={lensRows}
          patients={patients}
          onRowsChange={setLensRows}
          onPatientChange={(rxNo, patientName) =>
            setPatients((current) => ({ ...current, [rxNo]: patientName }))
          }
        />
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
        <SaveButton ready={problem === null} />
        <Link
          href={`/shop/orders/${invoice.id}`}
          className="text-navy-500 hover:text-navy-700 text-sm font-medium"
        >
          Cancel
        </Link>
        <span className="text-navy-400 text-xs">
          {problem ??
            "Freight and tax are set when you issue the invoice again."}
        </span>
      </div>
    </form>
  );
}
