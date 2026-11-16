import { formatPower } from "@/lib/format";

import type { Eye, StockBin } from "@/types/database";

import {
  charsAcross,
  toPrinterText,
  wrapLines,
  type LabelLine,
  type PrinterFont,
} from "./tspl";

/**
 * The stock lens box label, laid out as the maker's box label is: the lens name,
 * the power with its DS and DC units, ADD and the eye, Abbe and index, size and
 * colour, the brand, and the coating features that apply.
 *
 * What it says is decided here (stockLabelLines); where it sits on the 75 × 50 mm
 * roll is decided by buildLabelJob in tspl.ts.
 */

const DESCRIPTION_FONT: PrinterFont = { id: "4", widthDots: 24, pitchDots: 36 };
const DETAIL_FONT: PrinterFont = { id: "3", widthDots: 16, pitchDots: 28 };
const BRAND_FONT: PrinterFont = { id: "5", widthDots: 32, pitchDots: 52 };
const FEATURE_FONT: PrinterFont = { id: "2", widthDots: 12, pitchDots: 24 };

/** Space left below each block of the label, in dots. */
const BLOCK_GAP_DOTS = 10;

/** The coating features a box can carry, in the order they print. */
export const STOCK_FEATURES = [
  { key: "glare", label: "Glare" },
  { key: "scratch", label: "Scratch" },
  { key: "smudge", label: "Smudge" },
  { key: "water", label: "Water" },
  { key: "dust", label: "Dust" },
  { key: "uv", label: "UV Rays" },
  { key: "blueViolet", label: "Blue-Violet Light" },
] as const;

export type StockFeature = (typeof STOCK_FEATURES)[number]["key"];

/** What one stock label says. Blank text and a null power are left off the label. */
export interface StockLabelDetails {
  brand: string;
  description: string;
  sph: number | null;
  cyl: number | null;
  addPower: number | null;
  eye: Eye | null;
  abbe: string;
  index: string;
  size: string;
  colour: string;
  features: StockFeature[];
}

/** The details a label starts with: the product's name and the power of a stock bin. */
export function stockDetailsFor(
  productName: string,
  bin: Pick<StockBin, "sph" | "cyl" | "add_power" | "eye">,
): StockLabelDetails {
  return {
    brand: "",
    description: productName,
    sph: bin.sph,
    cyl: bin.cyl,
    addPower: bin.add_power,
    eye: bin.eye,
    abbe: "",
    index: "",
    size: "",
    colour: "",
    features: [],
  };
}

function joinParts(parts: (string | null)[]): string {
  return parts.filter((part): part is string => part !== null).join("  ");
}

/** One line per text that has something to say, cut to fit its font. */
function textLines(
  texts: (string | null)[],
  font: PrinterFont,
  align?: LabelLine["align"],
): LabelLine[] {
  const max = charsAcross(font);
  return texts
    .filter((text): text is string => text !== null && text.trim() !== "")
    .map((text) => {
      const clean = toPrinterText(text);
      const fitted =
        clean.length <= max ? clean : `${clean.slice(0, max - 2).trimEnd()}..`;
      return { text: fitted, font, align };
    });
}

/** The lines of one block, with a gap left below its last line. */
function block(lines: LabelLine[]): LabelLine[] {
  if (lines.length === 0) return lines;
  const last = lines[lines.length - 1];
  return [...lines.slice(0, -1), { ...last, gapAfterDots: BLOCK_GAP_DOTS }];
}

/**
 * What a stock label says, top to bottom. The lens name may wrap onto two lines.
 * The power reads SPH and CYL with their DS and DC units, then ADD and the eye.
 * A power the stock does not carry is left off rather than printed as zero, and
 * a line with nothing to say is left off, so a bare label prints compactly.
 */
export function stockLabelLines(details: StockLabelDetails): LabelLine[] {
  const description = wrapLines(
    toPrinterText(details.description),
    charsAcross(DESCRIPTION_FONT),
    2,
  ).map((text) => ({ text, font: DESCRIPTION_FONT }));

  const power = textLines(
    [
      joinParts([
        details.sph === null ? null : `SPH:${formatPower(details.sph)}DS`,
        details.cyl === null ? null : `CYL:${formatPower(details.cyl)}DC`,
      ]),
      joinParts([
        details.addPower === null
          ? null
          : `ADD:${formatPower(details.addPower)}`,
        details.eye,
      ]),
    ],
    DETAIL_FONT,
  );

  const measures = textLines(
    [
      joinParts([
        details.abbe.trim() ? `Abbe:${details.abbe.trim()}` : null,
        details.index.trim() ? `Index:${details.index.trim()}` : null,
      ]),
      joinParts([
        details.size.trim() ? `Size:${details.size.trim()}` : null,
        details.colour.trim() ? `Color:${details.colour.trim()}` : null,
      ]),
    ],
    DETAIL_FONT,
  );

  const brand = textLines([details.brand], BRAND_FONT, "center");

  const ticked = STOCK_FEATURES.filter((feature) =>
    details.features.includes(feature.key),
  )
    .map((feature) => feature.label)
    .join("  ");
  const features = wrapLines(
    toPrinterText(ticked),
    charsAcross(FEATURE_FONT),
    2,
  ).map((text) => ({ text, font: FEATURE_FONT }));

  return [
    ...block(description),
    ...block(power),
    ...block(measures),
    ...block(brand),
    ...features,
  ];
}
