import type { LensSign } from "@/types/database";

/**
 * Dioptre helpers shared by the power grid, the stock screen and the
 * purchase form. Pure functions, no React, so server and client both use them.
 */

/**
 * Every value in a product's range, nearest to zero first: -0.25, -0.50,
 * -0.75 … outward for a minus range, +0.25, +0.50 … for a plus one. That is
 * how the owner reads a stock sheet, and how the grid is laid out.
 *
 * Built by multiplying the step rather than adding it repeatedly: adding 0.25
 * eighty times drifts, and the drift surfaces as -0.7499999999 on screen and
 * as a missed bin match underneath.
 */
export function powerSeries(
  min: number | null,
  max: number | null,
  step: number | null,
  cap: number,
): number[] {
  if (min === null || max === null || !step || step <= 0 || max < min) {
    return [];
  }
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  return Array.from(
    { length: count },
    (_, i) => Math.round((min + i * step) * 100) / 100,
  )
    .sort(byDistanceFromZero)
    .slice(0, cap);
}

/** Sort comparator: nearest to zero first; on a tie, minus before plus. */
export function byDistanceFromZero(a: number, b: number): number {
  return Math.abs(a) - Math.abs(b) || a - b;
}

/** Order shelf positions the way the grid reads: by SPH, then CYL. */
export function byPosition(
  a: { sph: number | null; cyl: number | null },
  b: { sph: number | null; cyl: number | null },
): number {
  return (
    byDistanceFromZero(a.sph ?? 0, b.sph ?? 0) ||
    byDistanceFromZero(a.cyl ?? 0, b.cyl ?? 0)
  );
}

/**
 * A bin warns at its own reorder level or the product's alert quantity,
 * whichever is higher. Mirrors the `low_stock` view.
 */
export function isLow(
  bin: { qty_on_hand: number; reorder_level: number },
  product: { alert_qty: number | null },
): boolean {
  return bin.qty_on_hand <= Math.max(bin.reorder_level, product.alert_qty ?? 0);
}

/** Example SPH for an input, signed to match the lens: "+2.50" or "-2.00". */
export function sphPlaceholder(sign: LensSign | null | undefined): string {
  return sign === "plus" ? "+2.50" : "-2.00";
}
