"use client";

import { useState } from "react";
import { AlertCircle, Check, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { describeBin } from "@/lib/format";

import type { Product, StockBin } from "@/types/database";

import { MAX_LABEL_COPIES } from "./config";
import { LabelPrintError, sendLabelJob } from "./printClient";
import { toStockLabelContent } from "./stockLabel";
import { buildLabelJob, buildTestLabelJob } from "./tspl";

type Status =
  | { kind: "idle" }
  | { kind: "printing" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/**
 * Print small stock labels for one power of a product.
 *
 * Printing is manual: pick the power, say how many, press Print. The label is
 * built here and handed to the helper on this PC, which passes it to the label
 * printer — so it only prints from the PC the printer is plugged into.
 */
export function LabelPrintPanel({
  product,
  bins,
}: {
  product: Product;
  bins: StockBin[];
}) {
  const [binId, setBinId] = useState(bins[0]?.id ?? "");
  const [copies, setCopies] = useState("1");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const bin = bins.find((candidate) => candidate.id === binId) ?? bins[0];
  if (!product.tracks_stock || !bin) return null;

  const count = Number(copies);
  const copiesValid =
    Number.isInteger(count) && count >= 1 && count <= MAX_LABEL_COPIES;
  const printing = status.kind === "printing";

  async function send(job: string, doneMessage: string): Promise<void> {
    setStatus({ kind: "printing" });
    try {
      await sendLabelJob(job);
      setStatus({ kind: "done", message: doneMessage });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof LabelPrintError
            ? error.message
            : "Could not print the label. Please try again.",
      });
    }
  }

  function printLabels(): void {
    if (!bin || !copiesValid) return;
    const job = buildLabelJob(
      toStockLabelContent({
        productName: product.name,
        sph: bin.sph,
        cyl: bin.cyl,
        addPower: bin.add_power,
        eye: bin.eye,
      }),
      count,
    );
    void send(
      job,
      `Sent ${count} ${count === 1 ? "label" : "labels"} to the printer.`,
    );
  }

  return (
    <form
      className="shadow-lift rounded-2xl bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        printLabels();
      }}
    >
      <h2 className="text-base font-semibold">Print labels</h2>
      <p className="text-navy-500 mt-1 text-sm">
        Small labels for the lens packets. They print on the label printer
        plugged into this PC.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field name="labelBin" label="Power">
          {(p) => (
            <select
              {...p}
              value={bin.id}
              onChange={(event) => setBinId(event.target.value)}
            >
              {bins.map((option) => (
                <option key={option.id} value={option.id}>
                  {describeBin(option) || "No power"} · {option.qty_on_hand} on
                  hand
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          name="labelCopies"
          label="Labels to print"
          hint={`1 to ${MAX_LABEL_COPIES}`}
          errors={
            copiesValid
              ? undefined
              : [`Enter a number from 1 to ${MAX_LABEL_COPIES}.`]
          }
        >
          {(p) => (
            <input
              {...p}
              type="number"
              step="1"
              min={1}
              max={MAX_LABEL_COPIES}
              inputMode="numeric"
              value={copies}
              onChange={(event) => setCopies(event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={printing || !copiesValid}>
          <Printer className="size-4" aria-hidden />
          {printing ? "Printing…" : "Print labels"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={printing}
          onClick={() =>
            void send(buildTestLabelJob(), "Sent a test label to the printer.")
          }
        >
          Print a test label
        </Button>

        {status.kind === "done" && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-emerald-700"
          >
            <Check className="size-4" aria-hidden />
            {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-amber-700"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
