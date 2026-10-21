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

const amountField = z.coerce
  .number({ error: "Enter the amount received." })
  .positive("A payment must be more than zero.")
  .max(99_999_999, "That amount is out of range.");

const methodField = z.enum(
  ["cash", "bank_transfer", "cheque", "easypaisa", "jazzcash", "other"],
  { error: "Pick how it was paid." },
);

const referenceField = z
  .string()
  .trim()
  .max(80, "Keep the reference under 80 characters.")
  .optional()
  .or(z.literal(""));

const memoField = z
  .string()
  .trim()
  .max(400, "Keep the note under 400 characters.")
  .optional()
  .or(z.literal(""));

export const paymentSchema = z.object({
  customerId: z.uuid("Pick a customer."),

  entryKind: z
    .enum(["payment", "discount", "remove_discount"])
    .default("payment"),

  amount: amountField,

  method: methodField,

  /** Business date — a payment taken on Tuesday belongs on Tuesday's line. */
  entryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it was received."),

  reference: referenceField,

  memo: memoField,
});

export type PaymentPayload = z.output<typeof paymentSchema>;

/**
 * Correcting a saved payment or adjustment. The customer and the date are not
 * part of it (see migration 0047). How it was paid only matters for a payment,
 * so the action checks that against the entry.
 */
export const ledgerEntryEditSchema = z.object({
  entryId: z.uuid("Choose an entry to edit."),
  amount: amountField,
  method: methodField.optional(),
  reference: referenceField,
  memo: memoField,
});

export type LedgerEntryEditPayload = z.output<typeof ledgerEntryEditSchema>;
