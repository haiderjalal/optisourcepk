import { z } from "zod";

/**
 * A product, a service or a consumable — anything that can appear as a line on
 * an invoice.
 *
 * Two flags decide how a product behaves everywhere else:
 *
 * - `tracksPower` — stock is held per SPH (a lens). The invoice line carries
 *   CYL, AX and ADD too, but those do not split the stock bin.
 * - `tracksStock` — we hold it at all. Coatings and tints are billed per job
 *   and never held, so they get no bin. Giving them one would drift negative
 *   and then start rejecting perfectly valid invoices.
 */

export const PRODUCT_CATEGORIES = [
  { value: "lenses", label: "Ophthalmic lenses" },
  { value: "frames", label: "Frames" },
  { value: "accessories", label: "Accessories" },
  { value: "lab-supplies", label: "Lab supplies" },
  { value: "frame-parts-tools", label: "Frame parts & tools" },
  { value: "optometric", label: "Optometric equipment" },
  { value: "services", label: "Services (coatings, tints)" },
] as const;

const categoryValues = PRODUCT_CATEGORIES.map((c) => c.value) as unknown as [
  string,
  ...string[],
];

/** An optional bound: blank means not set. */
function rangeField(min: number, max: number, label: string) {
  return z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || Number.isFinite(v), {
      error: label + " is not a number.",
    })
    .refine((v) => v === null || (v >= min && v <= max), {
      error: label + " runs from " + min + " to " + max + ".",
    });
}

function stepField(label: string) {
  return z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0), {
      error: label + " must be greater than zero.",
    });
}

function intField(min: number, max: number, label: string) {
  return z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || Number.isInteger(v), {
      error: label + " is a whole number.",
    })
    .refine((v) => v === null || (v >= min && v <= max), {
      error: label + " runs from " + min + " to " + max + ".",
    });
}

export const productSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, "Enter a SKU.")
      .max(40, "That SKU is too long.")
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._/-]*$/,
        "Use letters, numbers, dot, dash, slash or underscore.",
      ),

    name: z
      .string()
      .trim()
      .min(2, "Enter the product name.")
      .max(160, "That name is too long."),

    category: z.enum(categoryValues, { error: "Pick a category." }),

    unit: z
      .string()
      .trim()
      .min(1, "Enter a unit, e.g. pairs or pcs.")
      .max(16, "That unit is too long."),

    listPrice: z.coerce
      .number({ error: "Enter a sale price, or 0." })
      .min(0, "A price cannot be negative.")
      .max(9_999_999, "That price is out of range.")
      .default(0),

    purchasePrice: z.coerce
      .number({ error: "Enter a purchase price, or 0." })
      .min(0, "A price cannot be negative.")
      .max(9_999_999, "That price is out of range.")
      .default(0),

    // The range a product is made in. Blank throughout means "no range set",
    // which is how every product behaved before these existed.
    sphMin: rangeField(-30, 30, "SPH minimum"),
    sphMax: rangeField(-30, 30, "SPH maximum"),
    sphStep: stepField("SPH step"),
    cylMin: rangeField(-12, 12, "CYL minimum"),
    cylMax: rangeField(-12, 12, "CYL maximum"),
    cylStep: stepField("CYL step"),
    addMin: rangeField(0, 6, "ADD minimum"),
    addMax: rangeField(0, 6, "ADD maximum"),
    addStep: stepField("ADD step"),
    axisMin: intField(0, 180, "Axis minimum"),
    axisMax: intField(0, 180, "Axis maximum"),
    axisStep: intField(1, 180, "Axis step"),
    eyes: z.enum(["", "both", "R", "L"]).optional(),

    tracksPower: z.coerce.boolean().default(false),
    tracksCyl: z.coerce.boolean().default(false),
    tracksAdd: z.coerce.boolean().default(false),
    tracksEye: z.coerce.boolean().default(false),
    tracksStock: z.coerce.boolean().default(true),
  })
  .refine(
    (value) =>
      !(
        value.tracksPower ||
        value.tracksCyl ||
        value.tracksAdd ||
        value.tracksEye
      ) || value.tracksStock,
    {
      // Mirrors products_power_needs_stock in the migration. Caught here so the
      // operator sees a sentence rather than a constraint name.
      error:
        "A product split by prescription must also be one you hold stock of.",
      path: ["tracksStock"],
    },
  );

export type ProductPayload = z.output<typeof productSchema>;
