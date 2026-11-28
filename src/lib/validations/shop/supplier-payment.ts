import { z } from "zod";

/**
 * Money sent to a supplier's account. The database refuses an amount above what
 * is owed to them; this checks the shape of the input and gives the message the
 * form shows.
 */

const methods = [
  "cash",
  "bank_transfer",
  "cheque",
  "easypaisa",
  "jazzcash",
  "other",
] as const;

export const supplierPaymentSchema = z.object({
  amount: z.coerce
    .number({ error: "Enter the amount sent." })
    .positive("A payment must be more than zero.")
    .max(99_999_999, "That amount is out of range."),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the money was sent.")
    .optional()
    .or(z.literal("")),
  method: z.enum(methods, { error: "Pick how it was sent." }),
  reference: z
    .string()
    .trim()
    .max(80, "Keep the reference under 80 characters.")
    .optional()
    .or(z.literal("")),
  memo: z
    .string()
    .trim()
    .max(400, "Keep the note under 400 characters.")
    .optional()
    .or(z.literal("")),
});

export type SupplierPaymentPayload = z.output<typeof supplierPaymentSchema>;
