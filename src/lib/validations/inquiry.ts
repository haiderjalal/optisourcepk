import { z } from "zod";
import { PHONE_PATTERN } from "./phone";

/**
 * The one definition of a valid trade inquiry.
 *
 * Imported by the form and by the route handler, so client and server can
 * never drift apart — a client-only rule is not a rule.
 */
export const inquiryLineSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().positive().max(1_000_000),
});

export const inquirySchema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(80, "That name is too long."),

  businessName: z
    .string()
    .trim()
    .min(2, "Please enter your practice or business name.")
    .max(120, "That business name is too long."),

  email: z
    .email("Please enter a valid email address.")
    .trim()
    .toLowerCase()
    .max(160),

  phone: z
    .string()
    .trim()
    .min(1, "Please enter a phone number we can reach you on.")
    .max(24)
    .regex(PHONE_PATTERN, "Please enter a valid Pakistani phone number."),

  city: z
    .string()
    .trim()
    .min(2, "Please enter your city.")
    .max(60, "That city name is too long."),

  businessType: z.enum(
    ["practice", "retailer", "lab", "hospital", "distributor", "other"],
    { message: "Please tell us what kind of business you are." },
  ),

  notes: z
    .string()
    .trim()
    .max(2000, "Please keep notes under 2000 characters.")
    .optional()
    .or(z.literal("")),

  lines: z
    .array(inquiryLineSchema)
    .max(40, "Please split requests over 40 lines across two inquiries.")
    .default([]),

  /**
   * Honeypot. Real people never see this field, so anything in it is a bot.
   * Named plausibly on purpose — "company" is what naive scripts fill first.
   *
   * It must PASS validation: the route handler accepts a filled honeypot
   * silently and drops it. Rejecting it here would both leak the trap in the
   * error payload and tell the script exactly which field to leave alone.
   */
  company: z.string().max(200).optional(),
});

export type InquiryInput = z.input<typeof inquirySchema>;
export type InquiryPayload = z.output<typeof inquirySchema>;

export const BUSINESS_TYPES: {
  value: InquiryPayload["businessType"];
  label: string;
}[] = [
  { value: "practice", label: "Optical practice / optometrist" },
  { value: "retailer", label: "Optical retailer" },
  { value: "lab", label: "Glazing / surfacing lab" },
  { value: "hospital", label: "Hospital or clinic" },
  { value: "distributor", label: "Distributor / reseller" },
  { value: "other", label: "Something else" },
];
