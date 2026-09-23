import { z } from "zod";
import { isQuarterStep } from "./stock";

/**
 * A purchase invoice as the form posts it: a header and its lines.
 *
 * The lines arrive as one JSON field, the same way the power grid posts its
 * quantities. The database re-checks everything in `record_purchase`; this
 * layer turns a mistake into a sentence before it gets there.
 */

const MAX_LINES = 5000;

function power(min: number, max: number, label: string) {
  return z
    .number()
    .nullable()
    .refine((v) => v === null || (v >= min && v <= max), {
      error: `${label} runs from ${min.toFixed(2)} to ${max.toFixed(2)}.`,
    })
    .refine((v) => v === null || isQuarterStep(v), {
      error: `${label} goes in 0.25 steps.`,
    });
}

export const purchaseLineSchema = z.object({
  productId: z.uuid("Pick a product on every line."),
  sph: power(-30, 30, "SPH"),
  cyl: power(-12, 12, "CYL"),
  add: power(0, 6, "ADD"),
  eye: z.enum(["R", "L"]).nullable(),
  qty: z
    .number()
    .int("Quantities are whole numbers.")
    .min(1, "Every line needs a quantity of at least 1.")
    .max(100_000, "That quantity is out of range."),
  /** Null uses the product's purchase price. */
  unitCost: z
    .number()
    .min(0, "A unit cost cannot be negative.")
    .max(9_999_999, "That unit cost is out of range.")
    .nullable(),
});

export const purchaseSchema = z.object({
  supplierId: z.uuid("Pick the supplier."),
  invoiceNo: z
    .string()
    .trim()
    .min(1, "Enter the supplier's invoice number.")
    .max(60, "That invoice number is too long."),
  invoiceDate: z.iso.date("Enter the invoice date."),
  notes: z
    .string()
    .trim()
    .max(400, "Keep the note under 400 characters.")
    .optional(),
  lines: z
    .array(purchaseLineSchema)
    .min(1, "Add at least one line.")
    .max(MAX_LINES, `That is more than ${MAX_LINES} lines in one go.`),
});

export type PurchasePayload = z.output<typeof purchaseSchema>;
