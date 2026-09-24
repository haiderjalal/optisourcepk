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
  const byCyl = sheet.cyls[0] !== null || sheet.cyls.length > 1;
  const sphLabel = (v: Power) => formatPower(v ?? 0);
  const cylLabel = (v: Power) => (byCyl ? formatPower(v ?? 0) : "Qty");
  const at = (sph: Power, cyl: Power) =>
    sheet.cells[`${sph ?? 0}|${cyl ?? ""}`];

  if (layout === "sph-down") {
    return {
      corner: byCyl ? "SPH | CYL" : "SPH",
      down: sheet.sphs,
      across: sheet.cyls,
      downLabel: sphLabel,
      acrossLabel: cylLabel,
      cell: (d, a) => at(d, a),
    };
  }
  return {
    corner: byCyl ? "CYL | SPH" : "SPH",
    down: sheet.cyls,
    across: sheet.sphs,
    downLabel: cylLabel,
    acrossLabel: sphLabel,
    cell: (d, a) => at(a, d),
  };
}
