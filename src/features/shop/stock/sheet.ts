import { formatPower } from "@/lib/format";
import {
  byDistanceFromZero,
  byPosition,
  gridLayout,
  isLow,
  powerSeries,
  type ColumnAxis,
} from "@/lib/power";
import type { Product, StockBin } from "@/types/database";

/**
 * A product's stock laid out like the printed stock list. Pure — no database,
 * no React — so the stock screen, the PDF and the tests all build the same
 * squares from the same bins.
 */

/** One square of the stock sheet: what is on hand at one SPH x column. */
export interface StockCell {
  qty: number;
  /** At or below the alert quantity (or the bin's own reorder level). */
  low: boolean;
}

/**
 * SPH down the side, one column per CYL (or per ADD for a product with only
 * an ADD range), both nearest zero first. `cols` is `[null]` for a product
 * held by SPH alone. `title` names the ADD when a product with both CYL and
 * ADD is shown as one sheet per ADD.
 */
export interface StockSheet {
  title: string | null;
  sphs: number[];
  colAxis: ColumnAxis;
  cols: (number | null)[];
  /** Keyed by `cellKey(sph, col)`; every row x column pair is present. */
  cells: Record<string, StockCell>;
  /** Some bins are also split by eye or another axis; a cell is their sum. */
  mixed: boolean;
}

export interface ProductStock {
  productId: string;
  name: string;
  unit: string;
  tracksPower: boolean;
  tracksStock: boolean;
  bins: StockBin[];
  /** Empty for a product that is not held by power. */
  sheets: StockSheet[];
  total: number;
  lowCount: number;
  emptyCount: number;
}

// Same caps as the receiving grid, so the two screens show the same powers.
const MAX_SPH_POSITIONS = 200;
const MAX_COL_POSITIONS = 60;

/** A zero CYL or ADD is stored as none, so both key the same square. */
export const cellKey = (sph: number, col: number | null) =>
  `${sph}|${col === null || col === 0 ? "" : col}`;

const noneIfZero = (v: number) => (v === 0 ? null : v);

function buildSheet(
  product: Product,
  bins: StockBin[],
  colAxis: ColumnAxis,
  title: string | null,
  mixesOther: boolean,
): StockSheet {
  const colOf = (bin: StockBin) =>
    colAxis === "add" ? bin.add_power : bin.cyl;

  const rangeSph = powerSeries(
    product.sph_min,
    product.sph_max,
    product.sph_step,
    MAX_SPH_POSITIONS,
  );
  const rangeCol = (
    colAxis === "add"
      ? powerSeries(
          product.add_min,
          product.add_max,
          product.add_step,
          MAX_COL_POSITIONS,
        )
      : powerSeries(
          product.cyl_min,
          product.cyl_max,
          product.cyl_step,
          MAX_COL_POSITIONS,
        )
  ).map(noneIfZero);

  const sphs = [...new Set([...rangeSph, ...bins.map((b) => b.sph ?? 0)])].sort(
    byDistanceFromZero,
  );
  const colSet = new Set<number | null>([
    ...rangeCol,
    ...bins.map((b) => noneIfZero(colOf(b) ?? 0)),
  ]);
  if (colSet.size === 0) colSet.add(null);
  // "None" is the 0.00 column, so it leads.
  const cols = [...colSet].sort((a, b) => byDistanceFromZero(a ?? 0, b ?? 0));

  const cells: Record<string, StockCell> = {};
  for (const sph of sphs) {
    for (const col of cols) {
      // 0 on hand is at or below any alert quantity that is set.
      cells[cellKey(sph, col)] = { qty: 0, low: product.alert_qty !== null };
    }
  }

  const seen = new Set<string>();
  for (const bin of bins) {
    const k = cellKey(bin.sph ?? 0, colOf(bin));
    const cell = cells[k];
    if (!seen.has(k)) {
      seen.add(k);
      cell.low = false;
    }
    cell.qty += bin.qty_on_hand;
    cell.low = cell.low || isLow(bin, product);
  }

  return {
    title,
    sphs,
    colAxis,
    cols,
    cells,
    mixed: bins.some(
      (b) =>
        b.eye !== null ||
        (mixesOther &&
          (colAxis === "add" ? b.cyl !== null : b.add_power !== null)),
    ),
  };
}

/**
 * Every sheet a product needs. One, normally; one per ADD when the product has
 * both a CYL and an ADD range, so every SPH x CYL x ADD box is visible and
 * nothing is added together.
 */
export function buildSheets(product: Product, bins: StockBin[]): StockSheet[] {
  if (!product.tracks_power) return [];
  const { colAxis, perAdd } = gridLayout(product);

  if (!perAdd) {
    const sheet = buildSheet(product, bins, colAxis, null, true);
    return sheet.sphs.length > 0 ? [sheet] : [];
  }

  const adds = [
    ...new Set<number | null>([
      ...powerSeries(
        product.add_min,
        product.add_max,
        product.add_step,
        MAX_COL_POSITIONS,
      ).map(noneIfZero),
      ...bins.map((b) => noneIfZero(b.add_power ?? 0)),
    ]),
  ].sort((a, b) => byDistanceFromZero(a ?? 0, b ?? 0));

  return adds
    .map((add) =>
      buildSheet(
        product,
        bins.filter((b) => noneIfZero(b.add_power ?? 0) === add),
        "cyl",
        add === null ? "No ADD" : `ADD ${formatPower(add)}`,
        false,
      ),
    )
    .filter((sheet) => sheet.sphs.length > 0);
}

export function toProductStock(
  product: Product,
  bins: StockBin[],
): ProductStock {
  const own = [...bins].sort(byPosition);
  const sheets = buildSheets(product, own);
  const cells = sheets.flatMap((sheet) => Object.values(sheet.cells));

  return {
    productId: product.id,
    name: product.name,
    unit: product.unit,
    tracksPower: product.tracks_power,
    tracksStock: product.tracks_stock,
    bins: own,
    sheets,
    total: own.reduce((sum, bin) => sum + bin.qty_on_hand, 0),
    lowCount: cells.filter((c) => c.low && c.qty > 0).length,
    emptyCount: cells.filter((c) => c.qty === 0).length,
  };
}
