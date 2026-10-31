import { PRINT_HELPER_URL, PRINT_REQUEST_TIMEOUT_MS } from "./config";

/**
 * Browser side of label printing: hand a finished label job to the helper
 * running on this PC. Client-only — it uses `fetch` against the loopback
 * address, which a server could never reach.
 */

export type LabelPrintFailure = "blocked" | "unreachable" | "rejected";

/** A print failure with a message that is safe to show as it is. */
export class LabelPrintError extends Error {
  readonly kind: LabelPrintFailure;

  constructor(kind: LabelPrintFailure, message: string) {
    super(message);
    this.name = "LabelPrintError";
    this.kind = kind;
  }
}

const BLOCKED_MESSAGE =
  "This browser is blocking the label printer. Click the settings icon beside the address bar, allow Local network access for this site, then try again.";

const UNREACHABLE_MESSAGE =
  "Can't reach the label printer helper on this PC. Make sure it is running, and that you are on the PC the printer is plugged into.";

const REJECTED_MESSAGE = "The label printer helper could not print the label.";

/**
 * Chrome and Edge ask before a public site talks to a program on this PC. A
 * browser that has no such permission throws on the name, which means there is
 * nothing to ask for, so the print is simply tried.
 */
async function getLoopbackPermission(): Promise<PermissionState> {
  if (!navigator.permissions?.query) return "prompt";
  try {
    const status = await navigator.permissions.query({
      name: "loopback-network" as PermissionName,
    });
    return status.state;
  } catch {
    return "prompt";
  }
}

async function readFailureMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return REJECTED_MESSAGE;
}

/**
 * Send a TSPL job to the helper. Call it from a click: the first time, the
 * browser shows its permission prompt, and it will not do so from page load.
 */
export async function sendLabelJob(tspl: string): Promise<void> {
  if ((await getLoopbackPermission()) === "denied") {
    throw new LabelPrintError("blocked", BLOCKED_MESSAGE);
  }

  // `targetAddressSpace` tells the browser this https page is deliberately
  // calling a program on this PC, which is what lets a plain-http address be
  // reached from it. It is not in the standard fetch typings yet.
  const init: RequestInit & { targetAddressSpace: "loopback" } = {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tspl }),
    signal: AbortSignal.timeout(PRINT_REQUEST_TIMEOUT_MS),
    targetAddressSpace: "loopback",
  };

  let response: Response;
  try {
    response = await fetch(`${PRINT_HELPER_URL}/print`, init);
  } catch {
    // A refused connection and a refused permission look the same here.
    const blocked = (await getLoopbackPermission()) === "denied";
    throw new LabelPrintError(
      blocked ? "blocked" : "unreachable",
      blocked ? BLOCKED_MESSAGE : UNREACHABLE_MESSAGE,
    );
  }

  if (!response.ok) {
    throw new LabelPrintError("rejected", await readFailureMessage(response));
  }
}
