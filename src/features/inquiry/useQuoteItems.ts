"use client";

import { useMemo } from "react";
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

  return useMemo<QuoteItemsView>(() => {
    const items = quote.lines.flatMap<QuoteItem>((line) => {
      const product = getProductById(line.productId);
      if (!product) return [];
      return [{ ...line, product }];
    });

    // Self-heal a saved list that references products we no longer carry.
    if (quote.hydrated && items.length !== quote.lines.length) {
      pruneLines(new Set(PRODUCTS.map((product) => product.id)));
    }

    return { ...quote, items, count: items.length };
  }, [quote]);
}
