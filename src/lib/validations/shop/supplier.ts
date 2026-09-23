import { z } from "zod";

/** Where stock is bought from. Only the name is required. */

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

export const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the supplier's name.")
    .max(120, "That name is too long."),
  phone: optionalText(80, "That phone number is too long."),
  city: optionalText(80, "That city name is too long."),
  address: optionalText(400, "That address is too long."),
  notes: optionalText(400, "Keep the notes under 400 characters."),
});

export type SupplierPayload = z.output<typeof supplierSchema>;
