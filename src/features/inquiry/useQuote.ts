"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getProductById } from "@/data/products";
import type { Product, QuoteLine } from "@/types/catalogue";
import {
  addLine,
  clearLines,
  getServerSnapshot,
  getSnapshot,
  removeLine,
  setLineQuantity,
  subscribe,
} from "./quoteStore";

export { MAX_QUOTE_LINES } from "./quoteStore";

export interface QuoteItem extends QuoteLine {
  product: Product;
  lineTotal: number;
}

export interface QuoteView {
  lines: QuoteLine[];
  items: QuoteItem[];
  count: number;
  subtotal: number;
  add: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  hydrated: boolean;
}

/**
 * Read the request list.
 *
 * There is no context provider: the store is a module singleton, so any
 * client component can subscribe directly without being wrapped.
 */
export function useQuote(): QuoteView {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo<QuoteView>(() => {
    const items = state.lines.flatMap<QuoteItem>((line) => {
      const product = getProductById(line.productId);
      if (!product) return [];
      return [
        {
          ...line,
          product,
          lineTotal: product.indicativePrice * line.quantity,
        },
      ];
    });

    return {
      lines: state.lines,
      items,
      count: items.length,
      subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
      add: addLine,
      setQuantity: setLineQuantity,
      remove: removeLine,
      clear: clearLines,
      has: (productId) =>
        state.lines.some((line) => line.productId === productId),
      hydrated: state.hydrated,
    };
  }, [state]);
}
