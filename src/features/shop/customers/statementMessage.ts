import { formatAmount } from "@/lib/format";

/**
 * The words that go with a shop's ledger statement on WhatsApp. Pure, so the
 * button and any check build the same text.
 */
export function statementShareMessage({
  shopName,
  balance,
}: {
  shopName: string;
  balance: number;
}): string {
  return [
    `Assalam-o-Alaikum, ${shopName}.`,
    "Your account statement with OptiSource PK is attached.",
    balanceLine(balance),
    "Thank you.",
  ].join("\n");
}

/** Positive is what the shop owes; negative means it is in credit. */
function balanceLine(balance: number): string {
  // Whole paisa, so a rounding crumb never reads as an outstanding balance.
  const paisa = Math.round(balance * 100) / 100;

  if (paisa > 0) return `Outstanding balance: Rs ${formatAmount(paisa)}.`;
  if (paisa < 0) {
    return `Your account is in credit by Rs ${formatAmount(-paisa)}.`;
  }
  return "Your account is fully settled.";
}
