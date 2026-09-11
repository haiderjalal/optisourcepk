"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useQuote } from "./useQuote";
import { formatPKR } from "@/lib/utils";
import type { Product } from "@/types/catalogue";

/**
 * Quantity stepper + add, for the product detail page.
 * Steps in multiples of the MOQ, because that is the unit we quote in.
 */
export function QuantityAdd({ product }: { product: Product }) {
  const { add } = useQuote();
  const [quantity, setQuantity] = useState(product.moq);
  const [added, setAdded] = useState(false);

  const step = product.moq;

  function handleAdd() {
    add(product.id, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2600);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="border-navy-200 flex items-center rounded-full border bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(step, q - step))}
            disabled={quantity <= step}
            className="text-navy-500 hover:text-navy-700 grid size-11 place-items-center rounded-full transition-colors disabled:opacity-35"
            aria-label={`Decrease quantity by ${step} ${product.unit}`}
          >
            <Minus className="size-4" aria-hidden />
          </button>

          <label className="px-1 text-center">
            <span className="sr-only">Quantity in {product.unit}</span>
            <input
              type="number"
              value={quantity}
              min={step}
              step={step}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuantity(Number.isFinite(next) ? next : step);
              }}
              onBlur={() => setQuantity((q) => Math.max(step, Math.round(q)))}
              className="font-display w-16 [appearance:textfield] bg-transparent text-center text-base font-semibold tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>

          <button
            type="button"
            onClick={() => setQuantity((q) => q + step)}
            className="text-navy-500 hover:text-navy-700 grid size-11 place-items-center rounded-full transition-colors"
            aria-label={`Increase quantity by ${step} ${product.unit}`}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>

        <span className="text-navy-400 text-sm">
          {product.unit} · minimum {product.moq}
        </span>
      </div>

      <p className="text-navy-500 mt-4 text-sm">
        Indicative line total{" "}
        <strong className="font-display text-navy-700 text-base font-semibold tabular-nums">
          {formatPKR(product.indicativePrice * quantity)}
        </strong>
      </p>

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
        <AnimatePresence>
          {added && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700"
            >
              <Check className="size-4" aria-hidden />
              Added {quantity} {product.unit} to your request list.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
