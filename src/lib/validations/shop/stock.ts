import { z } from "zod";

/**
 * Stock movements.
 *
 * Powers are quarter-dioptre steps, which the database also enforces. Checking
 * it here means the operator gets "Powers go in 0.25 steps" instead of a
 * constraint name, and a typo is caught before it reaches a transaction.
 */

export const STOCK_REASONS = [
  { value: "purchase", label: "Received from supplier" },
  { value: "return", label: "Returned by customer" },
  { value: "adjustment", label: "Correction / stock count" },
] as const;

const QUARTER_STEP = 0.25;

/** Guards against binary float drift: 0.1 + 0.2 style residue near zero. */
function isQuarterStep(value: number): boolean {
  return (
    Math.abs(Math.round(value / QUARTER_STEP) * QUARTER_STEP - value) < 1e-9
  );
}

/**
 * A dioptre field from a form: blank means "not applicable", and a value must
 * sit on a quarter step, inside the range an optician would ever write.
 */
export function dioptreField(min: number, max: number, label: string) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || Number.isFinite(value), {
      error: `${label} is not a number.`,
    })
    .refine((value) => value === null || (value >= min && value <= max), {
      error: `${label} runs from ${min.toFixed(2)} to ${max.toFixed(2)}.`,
    })
    .refine((value) => value === null || isQuarterStep(value), {
      error: `${label} goes in 0.25 steps.`,
    });
}

export const sphField = dioptreField(-30, 30, "SPH");

export const stockAdjustmentSchema = z.object({
  productId: z.uuid("Pick a product."),

  // Only the attributes a product is actually split by are stored — the
  // database flattens the rest to NULL, so a stray value is harmless.
  sph: sphField,
  cyl: dioptreField(-12, 12, "CYL"),
  addPower: dioptreField(0.25, 6, "ADD"),
  eye: z.enum(["", "R", "L"]).optional(),

  delta: z.coerce
    .number({ error: "Enter a quantity." })
    .int("Quantities are whole numbers.")
    .refine((value) => value !== 0, { error: "Enter a quantity other than 0." })
    .refine((value) => Math.abs(value) <= 100_000, {
      error: "That quantity is out of range.",
    }),

  reason: z.enum(["purchase", "return", "adjustment"], {
    error: "Pick a reason.",
  }),

  /** Warn once the bin drops to this. Blank leaves it unchanged. */
  alertQty: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || Number.isInteger(value), {
      error: "The alert quantity is a whole number.",
    })
    .refine((value) => value === null || (value >= 0 && value <= 100_000), {
      error: "That alert quantity is out of range.",
    }),

  note: z
    .string()
    .trim()
    .max(400, "Keep the note under 400 characters.")
    .optional(),
});

export type StockAdjustmentPayload = z.output<typeof stockAdjustmentSchema>;
