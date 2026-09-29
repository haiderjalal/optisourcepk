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

/** A short RX fitting detail (dia, base, prism…), passed on as typed. */
function fitting(label: string) {
  return z
    .string()
    .trim()
    .max(20, `Keep ${label} under 20 characters.`)
    .optional()
    .transform((value) => value || null);
}

export const orderLineSchema = z
  .object({
    // A stock order picks a product. An RX order may type one instead; a name
    // not seen before is added as an RX product when the order is saved.
    productId: z
      .union([z.uuid("Pick a product for every line."), z.literal("")])
      .optional()
      .transform((value) => value || null),
    productName: z
      .string()
      .trim()
      .max(120, "Keep the product name under 120 characters.")
      .optional()
      .transform((value) => value || null),
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
    addPower: dioptre(0, 6, "ADD"),
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
    // RX only: what the lab charges us, and which lab. Blank means not known yet.
    unitCost: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? Number(value) : null))
      .refine((value) => value === null || Number.isFinite(value), {
        error: "Purchase price is not a number.",
      })
      .refine((value) => value === null || (value >= 0 && value <= 9_999_999), {
        error: "Purchase price is out of range.",
      }),
    supplierId: z
      .union([z.uuid("Pick a lab from the list."), z.literal("")])
      .optional()
      .transform((value) => value || null),
    // RX fitting details, kept as written. Blank means not given.
    rxDia: fitting("Dia"),
    rxBase: fitting("Base"),
    rxFittingHeight: fitting("Fitting height"),
    rxPrism: fitting("Prism"),
    rxIpd: fitting("IPD"),
  })
  .refine((line) => line.productId !== null || line.productName !== null, {
    error: "Pick or type a product for every line.",
    path: ["productId"],
  })
  // Mirrors order_lines_ax_needs_cyl: an axis without a cylinder is
  // meaningless. A CYL of 0 means "no cylinder", so its axis is dropped on
  // save; a blank CYL with an axis is more likely a CYL forgotten, so ask.
  .refine((line) => line.ax === null || line.cyl !== null, {
    error: "An axis needs a cylinder value. Enter the CYL, or clear the axis.",
    path: ["ax"],
  });

export const orderSchema = z
  .object({
    customerId: z.uuid("Pick a customer."),
    externalOrderRef: z.string().trim().max(40).optional().or(z.literal("")),
    priority: z.enum(["normal", "urgent"]).default("normal"),
    /** Set when the order is started from the RX screen; fixed after that. */
    isRx: z.boolean().default(false),

    // The RX job card. Blank means not given; the patient is required on RX.
    patientName: z.string().trim().max(120).optional().or(z.literal("")),
    // "nv" is kept only so orders booked before KRY replaced it still save.
    rxLensType: z.enum(["", "sv", "kry", "nv", "dbf", "prog"]).optional(),
    rxTintReason: z.string().trim().max(400).optional().or(z.literal("")),
    frameMaterial: z.enum(["", "plastic", "metal"]).optional(),
    frameType: z.enum(["", "rimmed", "half", "rimless"]).optional(),

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
  })
  .refine((order) => !order.isRx || Boolean(order.patientName), {
    error: "Enter the patient's name.",
    path: ["patientName"],
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
