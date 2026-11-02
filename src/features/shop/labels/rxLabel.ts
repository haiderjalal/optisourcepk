import { karachiDate } from "@/lib/date-range";
import { formatPower } from "@/lib/format";
import type { Eye, Order, OrderLine } from "@/types/database";

import { MAX_LABEL_COPIES } from "./config";
import {
  WIDTH_DOTS,
  jobHeader,
  textCommand,
  toJob,
  toPrinterText,
  type PrinterFont,
} from "./tspl";

/**
 * The lens sticker for one eye of an RX job: the label that goes on the lens
 * packet, laid out as the lab's own sticker is.
 *
 * What it says is decided here (rxLabelFor); where it sits on the 75 × 25 mm
 * roll is decided below. The sticker is one eye, so an RX job with a pair prints
 * two stickers.
 */

/** The shop's name, as printed at the top of the sticker. */
const SHOP_NAME = "OPTISOURCE";

/** The lab's code, printed in brackets after the shop name. */
const LAB_CODE = "ISB";

const HEADER_FONT: PrinterFont = { id: "3", widthDots: 16, pitchDots: 26 };
const TEXT_FONT: PrinterFont = { id: "2", widthDots: 12, pitchDots: 20 };
const VALUE_FONT: PrinterFont = { id: "3", widthDots: 16, pitchDots: 26 };
const SMALL_FONT: PrinterFont = { id: "1", widthDots: 8, pitchDots: 12 };

const LEFT_DOTS = 10;
const LAB_NUMBER_X = 10;
const RX_NUMBER_X = 110;
const BARCODE_X = 230;
const SHIPPED_X = 300;
const BARCODE_HEIGHT_DOTS = 36;
/** Longer codes get thinner bars, so the barcode stays inside the label. */
const BARCODE_SHORT_CODE = 12;

/** Top of each line, in dots from the top of the label. */
const ROW = {
  header: 4,
  product: 30,
  coating: 50,
  tint: 70,
  headings: 92,
  values: 114,
  lab: 142,
  dates: 182,
} as const;

/** Where each power is printed across the sticker, with its heading. */
const POWER_COLUMNS = [
  { heading: "Dia", x: 10 },
  { heading: "Sph.", x: 130 },
  { heading: "Cyl.", x: 250 },
  { heading: "Axis", x: 370 },
  { heading: "ADD", x: 490 },
] as const;

/** Everything one sticker says, as plain values. */
export interface RxLabelData {
  eye: Eye | null;
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
export function rxLabelFor(order: Order, line: OrderLine): RxLabelData {
  return {
    eye: line.eye,
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
  rightEdge: number = WIDTH_DOTS - LEFT_DOTS,
): void {
  const clean = toPrinterText(value);
  if (!clean) return;
  const maxChars = Math.floor((rightEdge - x) / font.widthDots);
  commands.push(textCommand(x, y, font, fit(clean, maxChars)));
}

/** A power as the sticker shows it, with its sign: -2.75, +1.00. */
function powerText(value: number | null): string {
  return value === null ? "" : formatPower(value);
}

/**
 * A Code 128 barcode of the lab order number, or null when even the thinnest
 * bars would run off the sticker. The number is still printed as text then.
 */
function barcode(x: number, y: number, data: string): string | null {
  const narrow = data.length <= BARCODE_SHORT_CODE ? 2 : 1;
  // A Code 128 symbol is a start, the data, a check and a stop: 11 modules a
  // character, and 13 for the stop.
  const modules = (data.length + 2) * 11 + 13;
  if (modules * narrow > WIDTH_DOTS - LEFT_DOTS - x) return null;
  return `BARCODE ${x},${y},"128",${BARCODE_HEIGHT_DOTS},0,0,${narrow},${narrow},"${data}"`;
}

/** The lines of one sticker, after the job's own header. */
function stickerCommands(label: RxLabelData): string[] {
  const commands: string[] = [];
  const eye = label.eye ? `${label.eye}   ` : "";

  place(
    commands,
    LEFT_DOTS,
    ROW.header,
    HEADER_FONT,
    `${eye}${SHOP_NAME} (${LAB_CODE})`,
  );
  place(commands, LEFT_DOTS, ROW.product, TEXT_FONT, label.productName);
  place(
    commands,
    LEFT_DOTS,
    ROW.coating,
    TEXT_FONT,
    `Coating: ${(label.coating ?? "").toUpperCase()}`,
  );
  place(commands, LEFT_DOTS, ROW.tint, TEXT_FONT, `Tint: ${label.tint ?? ""}`);

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
  const bars = labCode ? barcode(BARCODE_X, ROW.lab, labCode) : null;
  if (bars) commands.push(bars);

  place(
    commands,
    LEFT_DOTS,
    ROW.dates,
    SMALL_FONT,
    `Ordered ${label.orderedOn}`,
  );
  if (label.shippedOn) {
    place(
      commands,
      SHIPPED_X,
      ROW.dates,
      SMALL_FONT,
      `Shipped ${label.shippedOn}`,
    );
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
