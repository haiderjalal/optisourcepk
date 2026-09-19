import { z } from "zod";
import { phoneField } from "../phone";

/**
 * One definition of a valid customer record, used by the form and by the
 * server action — a client-only rule is not a rule.
 *
 * Money arrives from an `<input type="number">` as a string, so the numeric
 * fields coerce. The database re-checks every bound in `0001_backoffice.sql`;
 * this layer exists to give a person a readable message, not to be the only
 * guard.
 */
export const customerSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Enter the contact's name.")
    .max(80, "That name is too long."),

  shopName: z
    .string()
    .trim()
    .min(2, "Enter the shop name.")
    .max(120, "That shop name is too long."),

  area: z
    .string()
    .trim()
    .min(2, "Enter the area.")
    .max(80, "That area name is too long."),

  address: z
    .string()
    .trim()
    .min(4, "Enter the delivery address.")
    .max(400, "That address is too long."),

  phone: phoneField("Enter a valid phone number for this shop."),

  phoneAlt: phoneField("That second number does not look valid.")
    .optional()
    .or(z.literal("")),

  ntn: z.string().trim().max(32).optional().or(z.literal("")),
  strn: z.string().trim().max(32).optional().or(z.literal("")),

  defaultDiscountPct: z.coerce
    .number({ error: "Enter a discount percentage, or 0." })
    .min(0, "Discount cannot be negative.")
    .max(100, "Discount cannot exceed 100%.")
    .default(0),

  /**
   * What the shop already owed when they were added to the system. Positive
   * means they owe us. Negative is allowed: some customers start in credit.
   */
  openingBalance: z.coerce
    .number({ error: "Enter an opening balance, or 0." })
    .min(-99_999_999, "That opening balance is out of range.")
    .max(99_999_999, "That opening balance is out of range.")
    .default(0),

  openingBalanceDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date for the opening balance."),

  notes: z
    .string()
    .trim()
    .max(2000, "Please keep notes under 2000 characters.")
    .optional()
    .or(z.literal("")),
});

export type CustomerInput = z.input<typeof customerSchema>;
export type CustomerPayload = z.output<typeof customerSchema>;
