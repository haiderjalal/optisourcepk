/**
 * WhatsApp messages for an RX job: the order to the lab, and "ready" to the
 * shop. Pure, so the order page and the check build the same text.
 *
 * These are wa.me share links — WhatsApp opens with the message typed, the
 * operator picks the contact and presses send. Nothing is sent from here.
 */

export interface RxMessageOrder {
  rxNo: number | null;
  patientName: string | null;
  lensType: string | null;
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
  rx_prism: string | null;
  rx_ipd: string | null;
}

/**
 * A WhatsApp share link: WhatsApp opens with the message typed and lets the
 * operator choose the chat. No number is filled in — who it goes to is their
 * call, not the system's.
 */
export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
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

/** Prism and IPD for one eye, when either is given. */
function fittingLine(line: RxMessageLine): string | null {
  const parts = [
    line.rx_prism && `Prism ${line.rx_prism}`,
    line.rx_ipd && `IPD ${line.rx_ipd}`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `     ${parts.join("  ")}`;
}

const capital = (v: string | null) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1) : null;

/** One RX job's lines for the lab: lens type, both eyes, lens and frame. */
function jobBlock(
  order: RxMessageOrder,
  lines: RxMessageLine[],
): (string | null)[] {
  const rank = (l: RxMessageLine) => (l.eye === "R" ? 0 : 1);
  const eyes = [...lines].sort((a, b) => rank(a) - rank(b));
  const frame = [capital(order.frameMaterial), capital(order.frameType)]
    .filter(Boolean)
    .join(", ");

  return [
    order.lensType ? `Lens type: ${order.lensType.toUpperCase()}` : null,
    "",
    ...eyes.flatMap((line) => [eyeLine(line), fittingLine(line)]),
    "",
    `Lens: ${lines[0]?.product_name ?? "—"}`,
    frame ? `Frame: ${frame}` : null,
  ];
}

/**
 * The job as the lab needs it: no prices, no tint reason (that is for our
 * records), and the optician only when the operator chooses to send it.
 */
export function labMessage(
  order: RxMessageOrder,
  lines: RxMessageLine[],
  { includeOptician = false }: { includeOptician?: boolean } = {},
): string {
  return [
    `*${rxNo(order.rxNo)}*`,
    includeOptician ? `Optician: ${order.shopName}` : null,
    `Patient: ${order.patientName ?? "—"}`,
    ...jobBlock(order, lines),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export interface RxMessageJob {
  order: RxMessageOrder;
  lines: RxMessageLine[];
}

/**
 * Every job for one patient booked the same day, in one message: the patient
 * once, then each job under its own RX number. One job reads exactly as
 * `labMessage`.
 */
export function patientLabMessage(
  jobs: RxMessageJob[],
  { includeOptician = false }: { includeOptician?: boolean } = {},
): string {
  if (jobs.length === 0) return "";
  if (jobs.length === 1) {
    return labMessage(jobs[0].order, jobs[0].lines, { includeOptician });
  }

  const first = jobs[0].order;
  return [
    includeOptician ? `Optician: ${first.shopName}` : null,
    `Patient: ${first.patientName ?? "—"}`,
    `${jobs.length} orders`,
    ...jobs.flatMap((job) => [
      "",
      `*${rxNo(job.order.rxNo)}*`,
      ...jobBlock(job.order, job.lines),
    ]),
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
