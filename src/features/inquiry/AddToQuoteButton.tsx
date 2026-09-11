"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useQuote } from "./useQuote";
import type { Product } from "@/types/catalogue";

/**
 * Adds a product to the visitor's request list at its minimum order
 * quantity. Confirms inline for a beat rather than firing a toast — the
 * feedback belongs where the click happened.
 */
export function AddToQuoteButton({
  product,
  quantity,
  variant = "primary",
  size = "sm",
  className,
  label = "Add to request",
}: {
  product: Product;
  quantity?: number;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
}) {
  const { add } = useQuote();
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    add(product.id, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  }

  return (
    <Button
      type="button"
      onClick={handleAdd}
      variant={variant}
      size={size}
      className={className}
      aria-label={`Add ${product.name} to your request list`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {justAdded ? (
          <motion.span
            key="added"
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Check className="size-4" aria-hidden />
            Added
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Plus className="size-4" aria-hidden />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
