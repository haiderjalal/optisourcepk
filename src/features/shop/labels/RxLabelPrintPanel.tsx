"use client";

import { useState } from "react";
import { AlertCircle, Check, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

import { MAX_LABEL_COPIES } from "./config";
import { LabelPrintError, sendLabelJob } from "./printClient";
import { buildRxLabelJob, type RxLabelData } from "./rxLabel";

type Status =
  | { kind: "idle" }
  | { kind: "printing" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/**
 * Print the lens stickers for an RX job: one for each lens, or just one of them.
 *
 * The sticker is built here and handed to the helper on this PC, the same as
 * the stock labels on the product page.
 */
export function RxLabelPrintPanel({ labels }: { labels: RxLabelData[] }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const printing = status.kind === "printing";

  async function send(chosen: RxLabelData[]): Promise<void> {
    const count = chosen.reduce((total, label) => total + label.copies, 0);
    setStatus({ kind: "printing" });
    try {
      await sendLabelJob(buildRxLabelJob(chosen));
      setStatus({
        kind: "done",
        message: `Sent ${count} ${count === 1 ? "sticker" : "stickers"} to the printer.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof LabelPrintError
            ? error.message
            : "Could not print the stickers. Please try again.",
      });
    }
  }

  return (
    <section className="shadow-lift rounded-2xl bg-white p-5">
      <h2 className="text-base font-semibold">Lens stickers</h2>
      <p className="text-navy-500 mt-1 text-sm">
        One sticker for each lens, printed on the label printer plugged into
        this PC. A lens with a quantity of 2 prints two stickers.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {labels.map((label, index) => (
          <Button
            key={`${label.eye ?? "lens"}-${index}`}
            type="button"
            variant="outline"
            disabled={printing || label.copies > MAX_LABEL_COPIES}
            onClick={() => void send([label])}
          >
            <Printer className="size-4" aria-hidden />
            {label.eye ? `Print ${label.eye} sticker` : "Print sticker"}
          </Button>
        ))}
        {labels.length > 1 && (
          <Button
            type="button"
            disabled={
              printing || labels.some((l) => l.copies > MAX_LABEL_COPIES)
            }
            onClick={() => void send(labels)}
          >
            <Printer className="size-4" aria-hidden />
            {printing ? "Printing…" : "Print all stickers"}
          </Button>
        )}

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
    </section>
  );
}
