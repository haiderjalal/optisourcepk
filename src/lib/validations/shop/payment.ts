import { z } from "zod";

/**
 * A payment received from a customer.
 *
 * Recorded against the account, not against a specific invoice: shops here pay
 * on account, in round sums, whenever they pay. Tying each receipt to an
 * invoice would force a guess we do not have.
 */

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "other", label: "Other" },
] as const;

export const paymentSchema = z.object({
  customerId: z.uuid("Pick a customer."),

  amount: z.coerce
    .number({ error: "Enter the amount received." })
    .positive("A payment must be more than zero.")
    .max(99_999_999, "That amount is out of range."),

  method: z.enum(
    ["cash", "bank_transfer", "cheque", "easypaisa", "jazzcash", "other"],
    { error: "Pick how it was paid." },
  ),

  /** Business date — a payment taken on Tuesday belongs on Tuesday's line. */
  entryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it was received."),

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

export type PaymentPayload = z.output<typeof paymentSchema>;
