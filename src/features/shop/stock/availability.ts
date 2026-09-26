/**
 * Can an order's lines be met from the shelf? Pure — no database — so the
 * order page and the tests run the same matching.
 *
 * Deliberately mirrors `issue_invoice` step for step: try the exact shelf
 * position, then the same power received for both eyes, then the plain SPH
 * bin, and sum demand per bin a line draws on. When this drifts from the
 * function, the page cheerfully reports stock the transaction then refuses,
 * which is worse than no check at all. The database stays the authority; this
 * is a preview of its answer.
 */

export interface LineAvailability {
  productId: string;
  productName: string;
  unit: string;
  sph: number | null;
  cyl: number | null;
  add_power: number | null;
  eye: string | null;
  needed: number;
  onHand: number;
  /** No bin matched at all — nothing has been received for this position. */
  missing: boolean;
  short: boolean;
}

export interface OrderLineDemand {
  product_id: string;
  sph: number | null;
  cyl: number | null;
  add_power: number | null;
  eye: string | null;
  quantity: number;
}

export interface ProductStockFlags {
  id: string;
  name: string;
  unit: string;
  tracks_stock: boolean;
}

export interface BinLevel {
  product_id: string;
  sph: number | null;
  cyl: number | null;
  add_power: number | null;
  eye: string | null;
  qty_on_hand: number;
}

interface Position {
  productId: string;
  sph: number | null;
  cyl: number | null;
  add: number | null;
  eye: string | null;
}

/**
 * A zero cylinder or addition means none, so it is the same bin as blank.
 * SPH is left alone: 0.00 there is a plano lens, a real power.
 */
function normalise(value: number | null): number | null {
  return value === 0 ? null : value;
}

const part = (v: number | string | null) => (v === null ? "~" : String(v));
const keyOf = (p: Position) =>
  [p.productId, part(p.sph), part(p.cyl), part(p.add), part(p.eye)].join("|");

export function resolveOrderStock(
  lines: OrderLineDemand[],
  products: ProductStockFlags[],
  bins: BinLevel[],
): LineAvailability[] {
  const productById = new Map(products.map((p) => [p.id, p]));

  const held = new Map<string, Position & { qty: number }>();
  for (const b of bins) {
    const position = {
      productId: b.product_id,
      sph: b.sph,
      cyl: normalise(b.cyl),
      add: normalise(b.add_power),
      eye: b.eye,
    };
    held.set(keyOf(position), { ...position, qty: b.qty_on_hand });
  }

  // Several lines can draw on one bin — an R and an L line on stock received
  // for both eyes, say — so demand is summed per bin before it is compared.
  // The database decrements line by line; the verdict is the same.
  const demand = new Map<
    string,
    { position: Position; qty: number; have: number | undefined }
  >();

  for (const line of lines) {
    const product = productById.get(line.product_id);
    if (!product?.tracks_stock) continue;

    const wanted: Position = {
      productId: line.product_id,
      sph: line.sph,
      cyl: normalise(line.cyl),
      add: normalise(line.add_power),
      eye: line.eye,
    };
    const bin =
      held.get(keyOf(wanted)) ??
      (wanted.eye !== null
        ? held.get(keyOf({ ...wanted, eye: null }))
        : undefined) ??
      held.get(keyOf({ ...wanted, cyl: null, add: null, eye: null }));

    const position = bin ?? wanted;
    const k = keyOf(position);
    const existing = demand.get(k);

    if (existing) existing.qty += line.quantity;
    else demand.set(k, { position, qty: line.quantity, have: bin?.qty });
  }

  const out: LineAvailability[] = [];

  for (const { position, qty, have } of demand.values()) {
    const product = productById.get(position.productId);

    out.push({
      productId: position.productId,
      productName: product?.name ?? "Unknown product",
      unit: product?.unit ?? "pcs",
      sph: position.sph,
      cyl: position.cyl,
      add_power: position.add,
      eye: position.eye,
      needed: qty,
      onHand: have ?? 0,
      missing: have === undefined,
      short: have !== undefined && have < qty,
    });
  }

  return out.sort((a, b) => a.productName.localeCompare(b.productName));
}
