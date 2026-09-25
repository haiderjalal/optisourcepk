"use client";

import { StockSheetTable } from "@/features/shop/products/StockSheetTable";
import type { StockSheet } from "@/services/shop/stock.service";
import { StockSheetActions } from "./StockSheetActions";
import { SwapLayoutButton } from "./SwapLayoutButton";
import { useSheetLayout } from "./useSheetLayout";

/**
 * A product's stock sheets — one, or one per ADD — with the swap, print and
 * share buttons. The layout
 * lives here so the table and the PDF it prints are always the same way round.
 */
export function StockSheetPanel({
  sheets,
  productId,
  productName,
  fileName,
}: {
  sheets: StockSheet[];
  productId: string;
  productName: string;
  fileName: string;
}) {
  // The printed stock list has SPH down the side, so that is the default.
  const [layout, swap] = useSheetLayout("sph-down");

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <SwapLayoutButton layout={layout} onSwap={swap} />
      </div>

      <div className="space-y-5">
        {sheets.map((sheet, i) => (
          <section key={sheet.title ?? i}>
            {sheet.title && (
              <h3 className="text-navy-700 mb-1.5 text-sm font-semibold">
                {sheet.title}
              </h3>
            )}
            <StockSheetTable sheet={sheet} layout={layout} />
            {sheet.mixed && (
              <p className="text-navy-400 mt-2 text-xs">
                Some of this stock is also split by eye
                {sheet.colAxis === "add" || sheet.title ? "" : " or ADD"}; each
                square adds those together. The product page has the detail.
              </p>
            )}
          </section>
        ))}
      </div>

      <div className="mt-4">
        <StockSheetActions
          productId={productId}
          productName={productName}
          fileName={fileName}
          layout={layout}
        />
      </div>
    </div>
  );
}
