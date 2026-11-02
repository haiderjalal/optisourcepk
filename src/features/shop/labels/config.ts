/**
 * Label stock and printer settings, in one place.
 *
 * These describe the roll loaded in the TSC TE244. If labels print shifted,
 * skip a label or come out cut off, these are the numbers to check — see
 * docs/label-printing.md.
 */

/** Label width in millimetres. */
export const LABEL_WIDTH_MM = 75;

/** Label height in millimetres. */
export const LABEL_HEIGHT_MM = 50;

/** Gap between two labels on the roll, in millimetres. */
export const LABEL_GAP_MM = 3;

/** The TE244 prints at 203 dpi, which is 8 dots to the millimetre. */
export const DOTS_PER_MM = 8;

/**
 * Where the printer's own origin sits, in dots: everything comes out this far
 * from where it is drawn. On the TE244 roll the stickers came out about 16 dots
 * too far left and 12 dots too low, so every command is moved by these. Set
 * both to 0 if the printer is calibrated and the frame sits flush on all sides.
 */
export const PRINT_OFFSET_X_DOTS = 16;
export const PRINT_OFFSET_Y_DOTS = -12;

/** 0 or 1. If the test label prints upside down, switch it to the other one. */
export const PRINT_DIRECTION = 1;

/** Print darkness, 0 (lightest) to 15 (darkest). */
export const PRINT_DENSITY = 8;

/** Print speed in inches per second. */
export const PRINT_SPEED = 4;

/** The most labels one press of Print will queue. */
export const MAX_LABEL_COPIES = 200;

/**
 * The helper that runs on the shop PC next to the printer (tools/label-printer).
 * The browser reaches it over the loopback address, so only that PC can print.
 */
export const PRINT_HELPER_URL = "http://127.0.0.1:9777";

/** The helper compiles a small script on each print, so allow it a moment. */
export const PRINT_REQUEST_TIMEOUT_MS = 20_000;
