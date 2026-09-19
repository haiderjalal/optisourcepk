import { z } from "zod";

/** Pakistani mobile and landline formats, with or without +92 / 0 prefix. */
export const PHONE_PATTERN = /^(\+92|0092|0)?[\s-]?\d{2,4}[\s-]?\d{6,8}$/;

/**
 * One definition of "a phone number we can call", shared by the public
 * inquiry form and the back-office customer record so the two cannot drift.
 */
export function phoneField(message = "Enter a valid Pakistani phone number.") {
  return z.string().trim().max(24).regex(PHONE_PATTERN, message);
}
