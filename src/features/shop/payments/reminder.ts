import { formatAmount } from "@/lib/format";

/**
 * WhatsApp payment reminders for shops that owe money. Pure, so the list and any
 * check build the same numbers and the same text.
 *
 * A reminder is a wa.me link with the shop's number and the message already
 * typed. WhatsApp opens on that chat, and the operator presses send; nothing is
 * sent from here.
 */

/** Digit runs that could be a phone number: a number has 10 to 15 digits in total. */
const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

/**
 * The international form WhatsApp needs (country code, no "+" or spaces), from
 * a number as it is typed: "0300-1234567", "+92 300 1234567", "00923001234567",
 * "051 2324512". A field holding two numbers ("03001234567 / 0512324512") uses
 * the first one. Null when no usable number is there.
 */
export function whatsappNumber(phone: string): string | null {
  const candidates = phone.split(/[\/,;|]/);

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    let digits = trimmed.replace(/\D/g, "");
    if (digits.length === 0) continue;

    if (trimmed.startsWith("+")) {
      // Already international.
    } else if (digits.startsWith("00")) {
      digits = digits.slice(2);
    } else if (digits.startsWith("0")) {
      // A national number: Pakistan's country code replaces the leading 0.
      digits = `92${digits.slice(1)}`;
    }

    if (digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS) {
      return digits;
    }
  }
  return null;
}

/** The reminder a shop reads: its name, what it owes, and a polite request. */
export function paymentReminderMessage({
  shopName,
  balance,
}: {
  shopName: string;
  balance: number;
}): string {
  return [
    `Assalam-o-Alaikum, ${shopName}.`,
    `Your account with OptiSource PK has an outstanding balance of Rs ${formatAmount(balance)}.`,
    "Please clear it at your earliest convenience. Thank you.",
  ].join("\n");
}

/** The wa.me link that opens the shop's chat with the reminder typed. */
export function paymentReminderLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
