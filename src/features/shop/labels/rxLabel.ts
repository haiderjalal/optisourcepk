import { karachiDate } from "@/lib/date-range";
import { formatPower } from "@/lib/format";
import type { Eye, Order, OrderLine } from "@/types/database";

import { MAX_LABEL_COPIES } from "./config";
import {
  WIDTH_DOTS,
  jobHeader,
  shifted,
  textCommand,
  toJob,
  toPrinterText,
  type PrinterFont,
} from "./tspl";

/**
 * The lens sticker for one eye of an RX job: the label that goes on the lens
 * packet, laid out as the lab's own sticker is.
 *
 * What it says is decided here (rxLabelFor); where it sits on the 75 × 50 mm
 * roll is decided below. The sticker is one eye, so an RX job with a pair prints
 * two stickers.
 */

/** The lab's code, printed in brackets after the shop name. */
const LAB_CODE = "ISB";

const HEADER_FONT: PrinterFont = { id: "4", widthDots: 24, pitchDots: 32 };
const TEXT_FONT: PrinterFont = { id: "3", widthDots: 16, pitchDots: 24 };
const VALUE_FONT: PrinterFont = { id: "4", widthDots: 24, pitchDots: 32 };
const DATE_FONT: PrinterFont = { id: "2", widthDots: 12, pitchDots: 20 };

/** Space between the sticker's edge and its text, in dots. */
const EDGE_DOTS = 12;

/** Top of each row, in dots from the top of the label. */
const ROW = {
  header: 12,
  name: 60,
  nameSecond: 88,
  coating: 136,
  tint: 164,
  headings: 200,
  values: 228,
  lab: 272,
  dates: 364,
} as const;

/** Where each power is printed across the sticker, with its heading. */
const POWER_COLUMNS = [
  { heading: "Dia", x: 12 },
  { heading: "Sph.", x: 100 },
  { heading: "Cyl.", x: 236 },
  { heading: "Axis", x: 372 },
  { heading: "ADD", x: 476 },
] as const;

const LAB_NUMBER_X = 12;
const RX_NUMBER_X = 150;
/** The barcode may not start left of this, so it clears the RX number. */
const BARCODE_LEFT_DOTS = 230;
const BARCODE_HEIGHT_DOTS = 80;
/** Longer codes get thinner bars, so the barcode stays inside the label. */
const BARCODE_SHORT_CODE = 12;

/** Everything one sticker says, as plain values. */
export interface RxLabelData {
  eye: Eye | null;
  /** The shop the order is for, printed at the top of its sticker. */
  shopName: string;
  productName: string;
  rxNo: number | null;
  coating: string | null;
  tint: string | null;
  dia: string | null;
  sph: number | null;
  cyl: number | null;
  axis: number | null;
  addPower: number | null;
  labOrderNo: string | null;
  /** "30/10/2026": the day the RX job was booked. */
  orderedOn: string;
  /** "30/10/2026": the day the job went to the lab, or null if it has not. */
  shippedOn: string | null;
  /** How many stickers this eye prints: the quantity on the job line. */
  copies: number;
}

/** "2026-10-30" becomes "30/10/2026", the way the lab writes dates. */
function dayMonthYear(at: string): string {
  const [year, month, day] = karachiDate(at).split("-");
  return `${day}/${month}/${year}`;
}

/** The sticker's content for one lens line of an RX order. */
export function rxLabelFor(
  order: Order,
  line: OrderLine,
  shopName: string,
): RxLabelData {
  return {
    eye: line.eye,
    shopName,
    productName: line.product_name,
    rxNo: order.rx_no,
    coating: order.rx_coating,
    tint: order.rx_tint_reason,
    dia: line.rx_dia,
    sph: line.sph,
    cyl: line.cyl,
    axis: line.ax,
    addPower: line.add_power,
    labOrderNo: order.lab_order_no,
    orderedOn: dayMonthYear(order.created_at),
    shippedOn: order.rx_sent_at ? dayMonthYear(order.rx_sent_at) : null,
    copies: line.quantity,
  };
}

/** Cut text to the characters that fit, ending ".." when it is cut. */
function fit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 2).trimEnd()}..`;
}

/** The characters that fit across the sticker, in a font. */
function charsAcross(font: PrinterFont): number {
  return Math.floor((WIDTH_DOTS - 2 * EDGE_DOTS) / font.widthDots);
}

/**
 * Print a line of text at x, unless there is nothing to print. It is cut to fit
 * before `rightEdge`, so it cannot run into the next thing on its row.
 */
function place(
  commands: string[],
  x: number,
  y: number,
  font: PrinterFont,
  value: string,
  rightEdge: number = WIDTH_DOTS - EDGE_DOTS,
): void {
  const clean = toPrinterText(value);
  if (!clean) return;
  const maxChars = Math.floor((rightEdge - x) / font.widthDots);
  commands.push(textCommand(x, y, font, fit(clean, maxChars)));
}

/** A line of text centred across the sticker. */
function placeCentred(
  commands: string[],
  y: number,
  font: PrinterFont,
  value: string,
): void {
  const clean = fit(toPrinterText(value), charsAcross(font));
  if (!clean) return;
  const x = Math.round((WIDTH_DOTS - clean.length * font.widthDots) / 2);
  commands.push(textCommand(x, y, font, clean));
}

/** A line of text ending at the sticker's right edge. */
function placeRight(
  commands: string[],
  y: number,
  font: PrinterFont,
  value: string,
): void {
  const clean = fit(toPrinterText(value), charsAcross(font));
  if (!clean) return;
  const x = WIDTH_DOTS - EDGE_DOTS - clean.length * font.widthDots;
  commands.push(textCommand(x, y, font, clean));
}

/**
 * The lens name in at most two lines. A name that does not fit on one line is
 * split at the space nearest its middle, so the lines are balanced; a name too
 * long even for two lines is cut at the end.
 */
function nameLines(name: string, maxChars: number): string[] {
  const words = toPrinterText(name).split(" ").filter(Boolean);
  const whole = words.join(" ");
  if (whole.length <= maxChars) return whole ? [whole] : [];

  let best: { first: string; second: string } | null = null;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(" ");
    const second = words.slice(i).join(" ");
    if (first.length > maxChars || second.length > maxChars) continue;
    const gap = Math.abs(first.length - second.length);
    if (!best || gap < Math.abs(best.first.length - best.second.length)) {
      best = { first, second };
    }
  }
  if (best) return [best.first, best.second];

  // No balanced split fits: fill the first line, then cut the rest.
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  const kept = lines.slice(0, 2);
  if (lines.length > 2) kept[1] = `${kept[1]} ${lines.slice(2).join(" ")}`;
  return kept.map((line) => fit(line, maxChars));
}

/** A power as the sticker shows it, with its sign: -2.75, +1.00. */
function powerText(value: number | null): string {
  return value === null ? "" : formatPower(value);
}

/** The width of a Code 128 barcode of `data`, in dots, with its bar width. */
function barcodeSize(data: string): { narrow: number; width: number } {
  const narrow = data.length <= BARCODE_SHORT_CODE ? 2 : 1;
  // A Code 128 symbol is a start, the data, a check and a stop: 11 modules a
  // character, and 13 for the stop.
  return { narrow, width: ((data.length + 2) * 11 + 13) * narrow };
}

/** The lines of one sticker, after the job's own header. */
function stickerCommands(label: RxLabelData): string[] {
  const commands: string[] = [];
  const eye = label.eye ? `${label.eye}   ` : "";

  // The ordering shop's name, in the largest type that fits on one line.
  const header = `${eye}${toPrinterText(label.shopName)} (${LAB_CODE})`;
  const headerFont =
    header.length <= charsAcross(HEADER_FONT) ? HEADER_FONT : TEXT_FONT;
  placeCentred(commands, ROW.header, headerFont, header);

  const [firstName = "", secondName = ""] = nameLines(
    label.productName,
    charsAcross(TEXT_FONT),
  );
  placeCentred(commands, ROW.name, TEXT_FONT, firstName);
  placeCentred(commands, ROW.nameSecond, TEXT_FONT, secondName);

  place(
    commands,
    EDGE_DOTS,
    ROW.coating,
    TEXT_FONT,
    `Coating: ${(label.coating ?? "").toUpperCase()}`,
  );
  place(commands, EDGE_DOTS, ROW.tint, TEXT_FONT, `Tint: ${label.tint ?? ""}`);

  const values = [
    label.dia ?? "",
    powerText(label.sph),
    powerText(label.cyl),
    label.axis === null ? "" : String(label.axis),
    label.addPower === null ? "" : label.addPower.toFixed(2),
  ];
  POWER_COLUMNS.forEach((column, index) => {
    place(commands, column.x, ROW.headings, TEXT_FONT, column.heading);
    place(commands, column.x, ROW.values, VALUE_FONT, values[index]);
  });

  const labCode = toPrinterText(label.labOrderNo ?? "");
  place(commands, LAB_NUMBER_X, ROW.lab, TEXT_FONT, labCode, RX_NUMBER_X - 8);
  if (label.rxNo !== null) {
    place(
      commands,
      RX_NUMBER_X,
      ROW.lab,
      TEXT_FONT,
      String(label.rxNo).padStart(4, "0"),
    );
  }
  // The barcode sits at the right, and is left off when it would not fit clear
  // of the lab number and the RX number. The number is still printed as text.
  if (labCode) {
    const { narrow, width } = barcodeSize(labCode);
    const x = WIDTH_DOTS - EDGE_DOTS - width;
    if (x >= BARCODE_LEFT_DOTS) {
      const at = shifted(x, ROW.lab);
      commands.push(
        `BARCODE ${at.x},${at.y},"128",${BARCODE_HEIGHT_DOTS},0,0,${narrow},${narrow},"${labCode}"`,
      );
    }
  }

  place(
    commands,
    EDGE_DOTS,
    ROW.dates,
    DATE_FONT,
    `Ordered ${label.orderedOn}`,
  );
  if (label.shippedOn) {
    placeRight(commands, ROW.dates, DATE_FONT, `Shipped ${label.shippedOn}`);
  }

  return commands;
}

/**
 * One TSPL job for the given stickers, each printed its own number of times.
 * Stickers in one job print in order, so an RX pair prints R then L.
 */
export function buildRxLabelJob(labels: RxLabelData[]): string {
  if (labels.length === 0) {
    throw new RangeError("There is no lens to print a label for.");
  }
  for (const label of labels) {
    if (
      !Number.isInteger(label.copies) ||
      label.copies < 1 ||
      label.copies > MAX_LABEL_COPIES
    ) {
      throw new RangeError(`Copies must be 1 to ${MAX_LABEL_COPIES}.`);
    }
  }

  const commands = jobHeader();
  labels.forEach((label, index) => {
    if (index > 0) commands.push("CLS");
    commands.push(...stickerCommands(label));
    commands.push(`PRINT 1,${label.copies}`);
  });
  return toJob(commands);
}
