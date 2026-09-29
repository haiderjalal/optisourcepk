/**
 * WhatsApp messages for an RX job: the order to the lab, and "ready" to the
 * shop. Pure, so the order page and the check build the same text.
 *
 * These are wa.me links — WhatsApp opens with the message typed, and the
 * operator presses send. Nothing is sent from the server.
 */

export interface RxMessageOrder {
  rxNo: number | null;
  patientName: string | null;
  lensType: string | null;
  tintReason: string | null;
  frameMaterial: string | null;
  frameType: string | null;
  shopName: string;
  invoiceNo: number | null;
  amount: number | null;
}

export interface RxMessageLine {
  eye: string | null;
  sph: number | null;
  cyl: number | null;
  ax: number | null;
  add_power: number | null;
  product_name: string;
}

/**
 * A Pakistani number as WhatsApp wants it: country code, digits only.
 * 0300-1234567, +92 300 1234567 and 0092… all become 923001234567.
 */
export function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

export function whatsappLink(phone: string | null, text: string): string {
  const number = whatsappNumber(phone);
  // No number: WhatsApp opens with the text and lets the operator pick a chat.
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}

const rxNo = (n: number | null) =>
  n === null ? "RX" : `RX-${String(n).padStart(4, "0")}`;

function power(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function eyeLine(line: RxMessageLine): string {
  const parts = [`SPH ${power(line.sph)}`];
  if (line.cyl !== null) parts.push(`CYL ${power(line.cyl)}`);
  if (line.ax !== null) parts.push(`AXIS ${line.ax}`);
  if (line.add_power !== null) parts.push(`ADD ${power(line.add_power)}`);
  return `${line.eye === "L" ? "L.E" : "R.E"}: ${parts.join("  ")}`;
}

const capital = (v: string | null) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1) : null;

/** The job as the lab needs it — no prices. */
export function labMessage(
  order: RxMessageOrder,
  lines: RxMessageLine[],
): string {
  const rank = (l: RxMessageLine) => (l.eye === "R" ? 0 : 1);
  const eyes = [...lines].sort((a, b) => rank(a) - rank(b));
  const frame = [capital(order.frameMaterial), capital(order.frameType)]
    .filter(Boolean)
    .join(", ");

  return [
    `*${rxNo(order.rxNo)}* — new RX order`,
    `Patient: ${order.patientName ?? "—"}`,
    order.lensType ? `Lens type: ${order.lensType.toUpperCase()}` : null,
    "",
    ...eyes.map(eyeLine),
    "",
    `Lens: ${lines[0]?.product_name ?? "—"}`,
    order.tintReason ? `Tint / photo / antiglare: ${order.tintReason}` : null,
    frame ? `Frame: ${frame}` : null,
    "",
    `Please confirm and quote the price. Ref ${rxNo(order.rxNo)}.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** To the shop: the lens is back and ready, with the amount if invoiced. */
export function shopMessage(order: RxMessageOrder): string {
  return [
    `Assalam-o-Alaikum, ${order.shopName}.`,
    `Your RX order *${rxNo(order.rxNo)}*${order.patientName ? ` for ${order.patientName}` : ""} is back from the lab and ready.`,
    order.invoiceNo !== null && order.amount !== null
      ? `Invoice ${order.invoiceNo}: Rs ${order.amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      : null,
    "Thank you.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
