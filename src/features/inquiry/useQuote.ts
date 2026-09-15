"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { QuoteLine } from "@/types/catalogue";
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

export interface QuoteView {
  lines: QuoteLine[];
  count: number;
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
 * Catalogue-free on purpose — the header subscribes to this on every page, so
 * anything imported here ships site-wide. Use `useQuoteItems` when you need
 * resolved product detail.
 *
 * There is no context provider: the store is a module singleton, so any client
 * component can subscribe directly without being wrapped.
 */
export function useQuote(): QuoteView {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo<QuoteView>(
    () => ({
      lines: state.lines,
      count: state.lines.length,
      add: addLine,
      setQuantity: setLineQuantity,
      remove: removeLine,
      clear: clearLines,
      has: (productId) =>
        state.lines.some((line) => line.productId === productId),
      hydrated: state.hydrated,
    }),
    [state],
  );
}
