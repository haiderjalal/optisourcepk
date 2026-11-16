import {
  DOTS_PER_MM,
  LABEL_GAP_MM,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  MAX_LABEL_COPIES,
  PRINT_DENSITY,
  PRINT_DIRECTION,
  PRINT_OFFSET_X_DOTS,
  PRINT_OFFSET_Y_DOTS,
  PRINT_SPEED,
} from "./config";

/**
 * Builds TSPL, the command language the TSC TE244 understands natively.
 *
 * Sending TSPL straight to the printer keeps text and (later) barcodes aligned
 * to the printer's own dots, which a driver-rendered page cannot promise. This
 * file knows about the label and the printer only — what a label says is
 * decided in the label's own file (stockLabel.ts, rxLabel.ts).
 */

export interface PrinterFont {
  /** The printer's built-in font number. */
  id: string;
  widthDots: number;
  /** Distance from one line to the next. */
  pitchDots: number;
}

/** One line of a label: its text, the font it is drawn in, and where it sits. */
export interface LabelLine {
  text: string;
  font: PrinterFont;
  align?: "left" | "center";
  /** Space left below this line before the next one, in dots. */
  gapAfterDots?: number;
}

export const WIDTH_DOTS = LABEL_WIDTH_MM * DOTS_PER_MM;
export const HEIGHT_DOTS = LABEL_HEIGHT_MM * DOTS_PER_MM;
/** The space kept clear at the left and right edges, in dots. */
export const MARGIN_DOTS = 16;
const TOP_DOTS = 10;
const BLOCK_GAP_DOTS = 10;

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

/** How many characters of a font fit across the label between the margins. */
export function charsAcross(font: PrinterFont): number {
  return Math.floor((WIDTH_DOTS - 2 * MARGIN_DOTS) / font.widthDots);
}

/** Break text on spaces into at most `maxLines`, ending ".." if it is cut. */
export function wrapLines(
  text: string,
  maxChars: number,
  maxLines: number,
): string[] {
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

/** A position moved by the printer's offset, so it lands where it is drawn. */
export function shifted(x: number, y: number): { x: number; y: number } {
  return { x: x + PRINT_OFFSET_X_DOTS, y: y + PRINT_OFFSET_Y_DOTS };
}

export function textCommand(
  x: number,
  y: number,
  font: PrinterFont,
  text: string,
) {
  const at = shifted(x, y);
  return `TEXT ${at.x},${at.y},"${font.id}",0,1,1,"${text}"`;
}

export function jobHeader(): string[] {
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
export function toJob(commands: string[]): string {
  return `${commands.join("\r\n")}\r\n`;
}

/**
 * One label design, printed `copies` times. The lines go down the label in the
 * order given. A line that would run past the bottom margin is refused rather
 * than printed cut off.
 */
export function buildLabelJob(lines: LabelLine[], copies: number): string {
  if (!Number.isInteger(copies) || copies < 1 || copies > MAX_LABEL_COPIES) {
    throw new RangeError(`Copies must be 1 to ${MAX_LABEL_COPIES}.`);
  }

  const commands = jobHeader();
  let y = TOP_DOTS;

  for (const line of lines) {
    if (y + line.font.pitchDots > HEIGHT_DOTS - MARGIN_DOTS) {
      throw new RangeError("These lines do not fit on the label.");
    }
    const text = toPrinterText(line.text);
    if (text) {
      const x =
        line.align === "center"
          ? Math.round((WIDTH_DOTS - text.length * line.font.widthDots) / 2)
          : MARGIN_DOTS;
      commands.push(textCommand(x, y, line.font, text));
    }
    y += line.font.pitchDots + (line.gapAfterDots ?? 0);
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
    `BOX ${shifted(0, 0).x},${shifted(0, 0).y},${WIDTH_DOTS - 2},${HEIGHT_DOTS - 2},2`,
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
