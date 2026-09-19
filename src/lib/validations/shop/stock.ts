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

export const sphField = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Number(value)))
  .refine((value) => value === null || Number.isFinite(value), {
    error: "That power is not a number.",
  })
  .refine((value) => value === null || (value >= -30 && value <= 30), {
    error: "Powers run from -30.00 to +30.00.",
  })
  .refine((value) => value === null || isQuarterStep(value), {
    error: "Powers go in 0.25 steps.",
  });

export const stockAdjustmentSchema = z.object({
  productId: z.uuid("Pick a product."),

  sph: sphField,

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

  note: z
    .string()
    .trim()
    .max(400, "Keep the note under 400 characters.")
    .optional(),
});

export type StockAdjustmentPayload = z.output<typeof stockAdjustmentSchema>;
