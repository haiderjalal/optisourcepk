"use client";

import { useEffect, useMemo } from "react";
import { PRODUCTS, getProductById } from "@/data/products";
import type { Product, QuoteLine } from "@/types/catalogue";
import { pruneLines } from "./quoteStore";
import { useQuote, type QuoteView } from "./useQuote";

export interface QuoteItem extends QuoteLine {
  product: Product;
}

export interface QuoteItemsView extends QuoteView {
  items: QuoteItem[];
}

/**
 * The request list with each line resolved against the catalogue.
 *
 * Importing this pulls the product data into the bundle, so only the request
 * list and the inquiry form use it — never the header.
 */
export function useQuoteItems(): QuoteItemsView {
  const quote = useQuote();

  const items = useMemo<QuoteItem[]>(
    () =>
      quote.lines.flatMap<QuoteItem>((line) => {
        const product = getProductById(line.productId);
        if (!product) return [];
        return [{ ...line, product }];
      }),
    [quote.lines],
  );

  // Self-heal a saved list that references products we no longer carry. This
  // writes to the shared store, so it runs after render, never during it.
  const hasStaleLines = quote.hydrated && items.length !== quote.lines.length;

  useEffect(() => {
    if (!hasStaleLines) return;
    pruneLines(new Set(PRODUCTS.map((product) => product.id)));
  }, [hasStaleLines]);

  return useMemo<QuoteItemsView>(
    () => ({ ...quote, items, count: items.length }),
    [quote, items],
  );
}
