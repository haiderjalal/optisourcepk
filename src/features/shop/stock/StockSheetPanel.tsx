"use client";

import { StockSheetTable } from "@/features/shop/products/StockSheetTable";
import type { StockSheet } from "@/services/shop/stock.service";
import { StockSheetActions } from "./StockSheetActions";
import { SwapLayoutButton } from "./SwapLayoutButton";
import { useSheetLayout } from "./useSheetLayout";

/**
 * A product's stock sheet with its swap, print and share buttons. The layout
 * lives here so the table and the PDF it prints are always the same way round.
 */
export function StockSheetPanel({
  sheet,
  productId,
  productName,
  fileName,
}: {
  sheet: StockSheet;
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

      <StockSheetTable sheet={sheet} layout={layout} />

      {sheet.mixesAddOrEye && (
        <p className="text-navy-400 mt-2 text-xs">
          Some of this stock is split by ADD or eye; each square adds those
          together. The product page has the detail.
        </p>
      )}

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
