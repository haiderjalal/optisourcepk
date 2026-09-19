import { z } from "zod";
import { sphField } from "./stock";

/**
 * An order and its lines.
 *
 * Mirrors the printed invoice exactly: each eye is its own line, and coatings
 * and tints are their own lines with no power values. Every bound here is also
 * a CHECK in the database — this layer exists so the operator gets a sentence
 * instead of a constraint name.
 */

const QUARTER = 0.25;

function quarterStep(value: number): boolean {
  return Math.abs(Math.round(value / QUARTER) * QUARTER - value) < 1e-9;
}

/** Optional dioptre field: blank is allowed, a value must be a 0.25 step. */
function dioptre(min: number, max: number, label: string) {
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
    .refine((value) => value === null || quarterStep(value), {
      error: `${label} goes in 0.25 steps.`,
    });
}

export const orderLineSchema = z
  .object({
    productId: z.uuid("Pick a product for every line."),
    orderRef: z.string().trim().max(40).optional().or(z.literal("")),
    eye: z.enum(["", "R", "L"]).optional(),
    sph: sphField,
    cyl: dioptre(-12, 12, "CYL"),
    ax: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : Number(value)))
      .refine((value) => value === null || Number.isInteger(value), {
        error: "AX is a whole number of degrees.",
      })
      .refine((value) => value === null || (value >= 0 && value <= 180), {
        error: "AX runs from 0 to 180.",
      }),
    addPower: dioptre(0.25, 6, "ADD"),
    unitPrice: z.coerce
      .number({ error: "Enter a rate." })
      .min(0, "A rate cannot be negative.")
      .max(9_999_999, "That rate is out of range."),
    discountPct: z.coerce
      .number({ error: "Enter a discount, or 0." })
      .min(0, "Discount cannot be negative.")
      .max(100, "Discount cannot exceed 100%.")
      .default(0),
    quantity: z.coerce
      .number({ error: "Enter a quantity." })
      .int("Quantities are whole numbers.")
      .positive("Quantity must be at least 1.")
      .max(100_000, "That quantity is out of range."),
  })
  // Mirrors order_lines_ax_needs_cyl: an axis without a cylinder is meaningless.
  .refine((line) => line.ax === null || line.cyl !== null, {
    error: "An axis needs a cylinder value.",
    path: ["ax"],
  });

export const orderSchema = z.object({
  customerId: z.uuid("Pick a customer."),
  externalOrderRef: z.string().trim().max(40).optional().or(z.literal("")),
  priority: z.enum(["normal", "urgent"]).default("normal"),

  orderByName: z.string().trim().max(120).optional().or(z.literal("")),
  deliverToName: z.string().trim().max(120).optional().or(z.literal("")),
  deliverToAddress: z.string().trim().max(400).optional().or(z.literal("")),
  deliverToArea: z.string().trim().max(80).optional().or(z.literal("")),
  deliverToPhone: z.string().trim().max(24).optional().or(z.literal("")),

  courierName: z.string().trim().max(80).optional().or(z.literal("")),
  trackingNo: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),

  lines: z
    .array(orderLineSchema)
    .min(1, "Add at least one line.")
    .max(200, "Split this across two orders — 200 lines is the limit."),
});

export const issueInvoiceSchema = z.object({
  orderId: z.uuid(),
  freight: z.coerce
    .number({ error: "Enter a freight charge, or 0." })
    .min(0, "Freight cannot be negative.")
    .max(9_999_999)
    .default(0),
  gstRate: z.coerce
    .number({ error: "Enter a GST rate, or 0." })
    .min(0)
    .max(100, "GST cannot exceed 100%.")
    .default(0),
  additionalTaxRate: z.coerce
    .number({ error: "Enter a rate, or 0." })
    .min(0)
    .max(100, "Additional tax cannot exceed 100%.")
    .default(0),
});

export type OrderPayload = z.output<typeof orderSchema>;
export type OrderLinePayload = z.output<typeof orderLineSchema>;
export type IssueInvoicePayload = z.output<typeof issueInvoiceSchema>;
