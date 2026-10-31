import {
  DOTS_PER_MM,
  LABEL_GAP_MM,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  MAX_LABEL_COPIES,
  PRINT_DENSITY,
  PRINT_DIRECTION,
  PRINT_SPEED,
} from "./config";

/**
 * Builds TSPL, the command language the TSC TE244 understands natively.
 *
 * Sending TSPL straight to the printer keeps text and (later) barcodes aligned
 * to the printer's own dots, which a driver-rendered page cannot promise. This
 * file knows about the label and the printer only — what a stock label says is
 * decided in stockLabel.ts.
 */

/** What a label says: a title that may wrap, then one line per row. */
export interface LabelContent {
  title: string;
  rows: string[];
}

interface PrinterFont {
  /** The printer's built-in font number. */
  id: string;
  widthDots: number;
  /** Distance from one line to the next. */
  pitchDots: number;
}

const WIDTH_DOTS = LABEL_WIDTH_MM * DOTS_PER_MM;
const HEIGHT_DOTS = LABEL_HEIGHT_MM * DOTS_PER_MM;
const MARGIN_DOTS = 16;
const TOP_DOTS = 10;
const BLOCK_GAP_DOTS = 10;
const TITLE_MAX_LINES = 2;

// Built-in fonts 3 and 4 are 16x24 and 24x32 dots at 203 dpi.
const TITLE_FONT: PrinterFont = { id: "3", widthDots: 16, pitchDots: 26 };
const ROW_FONT: PrinterFont = { id: "4", widthDots: 24, pitchDots: 40 };

/**
 * Reduce text to what the printer's built-in fonts can draw. Quotes and
 * backslashes would end or escape the TSPL string they sit in, so a product
 * name can never turn into a command.
 */
export function toPrinterText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["\\]/g, "'")
    .replace(/[^\x20-\x7e]/g, " ")
    .trim();
}

/** Break text on spaces into at most `maxLines`, ending ".." if it is cut. */
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(/ +/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.slice(0, maxChars);
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] =
    `${kept[maxLines - 1].slice(0, maxChars - 2).trimEnd()}..`;
  return kept;
}

function textCommand(x: number, y: number, font: PrinterFont, text: string) {
  return `TEXT ${x},${y},"${font.id}",0,1,1,"${text}"`;
}

function jobHeader(): string[] {
  return [
    `SIZE ${LABEL_WIDTH_MM} mm,${LABEL_HEIGHT_MM} mm`,
    `GAP ${LABEL_GAP_MM} mm,0 mm`,
    `DIRECTION ${PRINT_DIRECTION},0`,
    `DENSITY ${PRINT_DENSITY}`,
    `SPEED ${PRINT_SPEED}`,
    "CLS",
  ];
}

/** TSPL is line based and the printer expects CRLF. */
function toJob(commands: string[]): string {
  return `${commands.join("\r\n")}\r\n`;
}

/** One label design, printed `copies` times. */
export function buildLabelJob(content: LabelContent, copies: number): string {
  if (!Number.isInteger(copies) || copies < 1 || copies > MAX_LABEL_COPIES) {
    throw new RangeError(`Copies must be 1 to ${MAX_LABEL_COPIES}.`);
  }

  const usableDots = WIDTH_DOTS - 2 * MARGIN_DOTS;
  const commands = jobHeader();
  let y = TOP_DOTS;

  const titleLines = wrapLines(
    toPrinterText(content.title),
    Math.floor(usableDots / TITLE_FONT.widthDots),
    TITLE_MAX_LINES,
  );
  for (const line of titleLines) {
    commands.push(textCommand(MARGIN_DOTS, y, TITLE_FONT, line));
    y += TITLE_FONT.pitchDots;
  }
  if (titleLines.length > 0) y += BLOCK_GAP_DOTS;

  for (const row of content.rows) {
    const text = toPrinterText(row);
    if (!text) continue;
    commands.push(textCommand(MARGIN_DOTS, y, ROW_FONT, text));
    y += ROW_FONT.pitchDots;
  }

  commands.push(`PRINT 1,${copies}`);
  return toJob(commands);
}

/**
 * A frame around the whole label with its size written inside. If the frame is
 * cut off on any side, or a label is skipped, the size or gap in config.ts does
 * not match the roll.
 */
export function buildTestLabelJob(): string {
  return toJob([
    ...jobHeader(),
    `BOX 0,0,${WIDTH_DOTS - 2},${HEIGHT_DOTS - 2},2`,
    textCommand(MARGIN_DOTS, TOP_DOTS, TITLE_FONT, "TOP-LEFT"),
    textCommand(
      MARGIN_DOTS,
      TOP_DOTS + TITLE_FONT.pitchDots + BLOCK_GAP_DOTS,
      ROW_FONT,
      `${LABEL_WIDTH_MM} x ${LABEL_HEIGHT_MM} mm`,
    ),
    textCommand(
      MARGIN_DOTS,
      HEIGHT_DOTS - 40,
      TITLE_FONT,
      "Frame must show on all 4 sides",
    ),
    "PRINT 1,1",
  ]);
}
