import { getProductById } from "@/data/products";
import type { QuoteLine } from "@/types/catalogue";

const STORAGE_KEY = "optisource.quote.v1";

/** Guard rail so a runaway loop cannot build an un-quotable request. */
export const MAX_QUOTE_LINES = 40;

export interface QuoteState {
  lines: QuoteLine[];
  /** False until localStorage has been read, so SSR and client agree. */
  hydrated: boolean;
}

/**
 * The request list, held as a tiny external store.
 *
 * `useSyncExternalStore` rather than `useState` + effects: it gives a stable
 * server snapshot (so hydration never mismatches), reads storage exactly once
 * on first subscribe, and keeps multiple tabs in step through the `storage`
 * event — all without a mount effect that writes state.
 */
const SERVER_STATE: QuoteState = { lines: [], hydrated: false };

let state: QuoteState = SERVER_STATE;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function commit(lines: QuoteLine[]): void {
  state = { lines, hydrated: true };
  notify();
}

function read(): QuoteLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Drop anything that no longer resolves to a catalogue product — the
    // catalogue changes far more often than a visitor's saved request.
    return parsed
      .filter(
        (line): line is QuoteLine =>
          typeof line === "object" &&
          line !== null &&
          typeof (line as QuoteLine).productId === "string" &&
          Number.isFinite((line as QuoteLine).quantity),
      )
      .filter((line) => Boolean(getProductById(line.productId)))
      .slice(0, MAX_QUOTE_LINES);
  } catch {
    return [];
  }
}

function persist(lines: QuoteLine[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private mode or quota exceeded — the request still works for this
    // session, it just will not survive a reload.
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  commit(read());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    window.addEventListener("storage", handleStorage);
    if (!state.hydrated) commit(read());
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function getSnapshot(): QuoteState {
  return state;
}

export function getServerSnapshot(): QuoteState {
  return SERVER_STATE;
}

/* -------------------------------------------------------------- */
/* Mutations                                                       */
/* -------------------------------------------------------------- */

function write(next: QuoteLine[]): void {
  persist(next);
  commit(next);
}

export function addLine(productId: string, quantity?: number): void {
  const product = getProductById(productId);
  if (!product) return;

  const requested = quantity ?? product.moq;
  const existing = state.lines.find((line) => line.productId === productId);

  if (existing) {
    write(
      state.lines.map((line) =>
        line.productId === productId
          ? { ...line, quantity: line.quantity + requested }
          : line,
      ),
    );
    return;
  }

  if (state.lines.length >= MAX_QUOTE_LINES) return;
  write([...state.lines, { productId, quantity: requested }]);
}

export function setLineQuantity(productId: string, quantity: number): void {
  const product = getProductById(productId);
  if (!product) return;

  // Never let a line fall below the minimum order quantity we can quote.
  const clamped = Math.max(product.moq, Math.round(quantity));

  write(
    state.lines.map((line) =>
      line.productId === productId ? { ...line, quantity: clamped } : line,
    ),
  );
}

export function removeLine(productId: string): void {
  write(state.lines.filter((line) => line.productId !== productId));
}

export function clearLines(): void {
  write([]);
}
