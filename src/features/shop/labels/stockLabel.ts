import { formatPower } from "@/lib/format";

import type { Eye } from "@/types/database";

import type { LabelContent } from "./tspl";

/** The part of a stock bin a label is made from. */
export interface StockLabelData {
  productName: string;
  sph: number | null;
  cyl: number | null;
  addPower: number | null;
  eye: Eye | null;
}

function joinParts(parts: (string | null)[]): string {
  return parts.filter((part): part is string => part !== null).join("  ");
}

/**
 * What a stock lens label says: the product name, then SPH and CYL on one
 * line, then ADD and the eye on the next, as on the labels already stuck on the
 * lens packets. A power the bin does not carry is left off rather than printed
 * as zero.
 *
 * The longest possible line ("SPH:-30.00  CYL:-12.00") is 22 characters, which
 * fits the label width, so no line is ever cut short.
 */
export function toStockLabelContent(data: StockLabelData): LabelContent {
  return {
    title: data.productName,
    rows: [
      joinParts([
        data.sph === null ? null : `SPH:${formatPower(data.sph)}`,
        data.cyl === null ? null : `CYL:${formatPower(data.cyl)}`,
      ]),
      joinParts([
        data.addPower === null ? null : `ADD:${formatPower(data.addPower)}`,
        data.eye,
      ]),
    ],
  };
}
