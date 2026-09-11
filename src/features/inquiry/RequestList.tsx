"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { ProductGlyph } from "@/components/shared/ProductGlyph";
import { ButtonLink } from "@/components/ui/button";
import { useQuote } from "./useQuote";
import { formatPKR } from "@/lib/utils";

export function RequestList() {
  const { items, subtotal, setQuantity, remove, clear, hydrated } = useQuote();

  if (!hydrated) {
    return (
      <div
        className="rounded-card border-navy-100 h-64 animate-pulse border bg-white/60"
        aria-hidden
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border-navy-200 border border-dashed bg-white/60 px-6 py-14 text-center">
        <span className="bg-navy-50 mx-auto grid size-12 place-items-center rounded-full">
          <ShoppingBag className="text-navy-400 size-5" aria-hidden />
        </span>
        <h2 className="mt-5 text-lg font-semibold">
          Your request list is empty.
        </h2>
        <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
          Add lines from the catalogue and they will appear here — or send the
          form on its own and tell us what you need in the notes.
        </p>
        <ButtonLink
          href="/catalogue"
          variant="outline"
          size="sm"
          className="mt-6"
        >
          Browse the catalogue
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="rounded-card border-navy-100 overflow-hidden border bg-white">
      <div className="border-navy-100 flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-sm font-semibold">
          Request list
          <span className="text-navy-400 ml-2 font-normal">
            {items.length} {items.length === 1 ? "line" : "lines"}
          </span>
        </h2>
        <button
          type="button"
          onClick={clear}
          className="text-navy-400 text-xs font-medium transition-colors hover:text-red-600"
        >
          Clear all
        </button>
      </div>

      <ul className="divide-navy-100 divide-y">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.productId}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex gap-4 p-5">
                <ProductGlyph
                  category={item.product.category}
                  className="h-16 w-24 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-accent-600 text-[0.625rem]">
                    {item.product.range}
                  </p>
                  <h3 className="mt-1 text-sm leading-snug font-semibold">
                    <Link
                      href={`/catalogue/${item.product.category}/${item.product.slug}`}
                      className="hover:text-accent-700"
                    >
                      {item.product.name}
                    </Link>
                  </h3>
                  <p className="text-navy-400 mt-1 text-xs">
                    {formatPKR(item.product.indicativePrice)} per{" "}
                    {item.product.unit.replace(/s$/, "")} · min{" "}
                    {item.product.moq}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="border-navy-200 flex items-center rounded-full border">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity(
                            item.productId,
                            item.quantity - item.product.moq,
                          )
                        }
                        disabled={item.quantity <= item.product.moq}
                        className="text-navy-500 hover:text-navy-700 grid size-8 place-items-center rounded-full transition-colors disabled:opacity-35"
                        aria-label={`Decrease ${item.product.name}`}
                      >
                        <Minus className="size-3.5" aria-hidden />
                      </button>
                      <span className="font-display w-12 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity(
                            item.productId,
                            item.quantity + item.product.moq,
                          )
                        }
                        className="text-navy-500 hover:text-navy-700 grid size-8 place-items-center rounded-full transition-colors"
                        aria-label={`Increase ${item.product.name}`}
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-display text-sm font-semibold tabular-nums">
                        {formatPKR(item.lineTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(item.productId)}
                        className="text-navy-300 grid size-8 place-items-center rounded-full transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${item.product.name} from your request list`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="border-navy-100 border-t bg-mist-50 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-navy-500 text-sm">Indicative total</span>
          <span className="font-display text-xl font-bold tabular-nums">
            {formatPKR(subtotal)}
          </span>
        </div>
        <p className="text-navy-400 mt-2 text-xs leading-relaxed">
          Indicative only. Sales tax, volume discounts and freight are applied
          on the written quotation we send back.
        </p>
      </div>
    </div>
  );
}
