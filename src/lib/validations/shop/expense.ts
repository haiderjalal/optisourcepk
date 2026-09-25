import { z } from "zod";

/** Suggestions offered in the item box; any other item can be typed. */
export const COMMON_EXPENSES = [
  "Fitting charges",
  "Delivery",
  "Milk",
  "Chai",
  "Drinks",
  "Courier",
  "Fuel",
  "Electricity",
  "Rent",
  "Stationery",
] as const;

/** `YYYY-MM`, the month an expense list is read by. */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month.");

export const expenseSchema = z.object({
  expenseDate: z.iso.date("Enter the date."),
  item: z
    .string()
    .trim()
    .min(1, "Enter what it was for, e.g. Chai.")
    .max(120, "That item name is too long."),
  amount: z.coerce
    .number({ error: "Enter the amount." })
    .gt(0, "Enter an amount above zero.")
    .max(9_999_999, "That amount is out of range."),
  note: z
    .string()
    .trim()
    .max(400, "Keep the note under 400 characters.")
    .optional(),
});

export type ExpensePayload = z.output<typeof expenseSchema>;
