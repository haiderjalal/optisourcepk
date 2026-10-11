"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info, Minus, Plus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { MAX_LINE_QUANTITY } from "@/lib/quote-limits";
import { useQuote } from "./useQuote";
import type { Product } from "@/types/catalogue";

type Feedback =
  | { kind: "idle" }
  | { kind: "added"; quantity: number; id: number }
  | { kind: "full"; id: number };

const FEEDBACK_MS = 2600;

/**
 * Quantity stepper + add, for the product detail page.
 *
 * A plain count — no minimum and no running total. The trade desk confirms
 * both the order quantity and the price on the written quotation, against
 * whatever volume the customer actually asks for.
 */
export function QuantityAdd({ product }: { product: Product }) {
  const { add } = useQuote();
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleAdd() {
    const added = add(product.id, quantity);
    const id = Date.now();

    setFeedback(added ? { kind: "added", quantity, id } : { kind: "full", id });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setFeedback({ kind: "idle" }),
      FEEDBACK_MS,
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="border-navy-200 flex items-center rounded-full border bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="text-navy-500 hover:text-navy-700 grid size-11 place-items-center rounded-full transition-colors disabled:opacity-35"
            aria-label={`Decrease quantity of ${product.name}`}
          >
            <Minus className="size-4" aria-hidden />
          </button>

          <label className="px-1 text-center">
            <span className="sr-only">Quantity in {product.unit}</span>
            <input
              type="number"
              value={quantity}
              min={1}
              max={MAX_LINE_QUANTITY}
              step={1}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuantity(
                  Number.isFinite(next) ? Math.min(MAX_LINE_QUANTITY, next) : 1,
                );
              }}
              onBlur={() =>
                setQuantity((q) =>
                  Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.round(q))),
                )
              }
              className="font-display w-16 [appearance:textfield] bg-transparent text-center text-base font-semibold tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>

          <button
            type="button"
            onClick={() =>
              setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))
            }
            className="text-navy-500 hover:text-navy-700 grid size-11 place-items-center rounded-full transition-colors"
            aria-label={`Increase quantity of ${product.name}`}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>

        <span className="text-navy-400 text-sm">{product.unit}</span>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" size="lg" onClick={handleAdd}>
          <Plus className="size-4" aria-hidden />
          Add to request list
        </Button>
        <ButtonLink href="/inquiry" variant="outline" size="lg">
          Review request list
        </ButtonLink>
      </div>

      <div aria-live="polite" className="min-h-6">
        {feedback.kind === "added" && (
          <p
            key={feedback.id}
            className="animate-rise mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700"
          >
            <Check className="size-4" aria-hidden />
            Added {feedback.quantity} {product.unit} to your request list.
          </p>
        )}
        {feedback.kind === "full" && (
          <p
            key={feedback.id}
            className="animate-rise text-navy-600 mt-3 flex items-center gap-2 text-sm font-medium"
          >
            <Info className="size-4" aria-hidden />
            Your request list is full. Remove a line to add another.
          </p>
        )}
      </div>
    </div>
  );
}
