import { formatPower } from "@/lib/format";
import type { StockCell, StockSheet } from "@/services/shop/stock.service";

/**
 * Which way round a power grid is drawn: SPH down the side (the printed stock
 * list) or SPH across the top. Pure, so the screen and the PDF turn a sheet
 * the same way.
 */

export type SheetLayout = "sph-down" | "sph-across";

type Power = number | null;

/** A stock sheet turned whichever way round it is being drawn. */
export interface OrientedSheet {
  corner: string;
  down: Power[];
  across: Power[];
  downLabel: (value: Power) => string;
  acrossLabel: (value: Power) => string;
  cell: (down: Power, across: Power) => StockCell | undefined;
}

export function orientSheet(
  sheet: StockSheet,
  layout: SheetLayout,
): OrientedSheet {
  const colName = sheet.colAxis === "add" ? "ADD" : "CYL";
  // A product held by SPH alone has one unnamed column.
  const hasCols = sheet.cols[0] !== null || sheet.cols.length > 1;
  const sphLabel = (v: Power) => formatPower(v ?? 0);
  const colLabel = (v: Power) =>
    !hasCols
      ? "Qty"
      : v === null && sheet.colAxis === "add"
        ? "No ADD"
        : formatPower(v ?? 0);
  const at = (sph: Power, col: Power) =>
    sheet.cells[`${sph ?? 0}|${col ?? ""}`];

  if (layout === "sph-down") {
    return {
      corner: hasCols ? `SPH | ${colName}` : "SPH",
      down: sheet.sphs,
      across: sheet.cols,
      downLabel: sphLabel,
      acrossLabel: colLabel,
      cell: (d, a) => at(d, a),
    };
  }
  return {
    corner: hasCols ? `${colName} | SPH` : "SPH",
    down: sheet.cols,
    across: sheet.sphs,
    downLabel: colLabel,
    acrossLabel: sphLabel,
    cell: (d, a) => at(a, d),
  };
}
