import { MAX_LINE_QUANTITY, MAX_QUOTE_LINES } from "@/lib/quote-limits";
import type { QuoteLine } from "@/types/catalogue";

// v3: lines no longer carry a minimum order quantity.
const STORAGE_KEY = "optisource.quote.v3";

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
 *
 * This module deliberately imports NOTHING from `@/data`. The header reads it
 * on every page just to render a badge count, so pulling the catalogue in here
 * would ship the whole product list to every visitor. Catalogue resolution
 * lives in `useQuoteItems`.
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

/** Whole-number count inside the limits the server will accept. */
function clampQuantity(quantity: number): number {
  return Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.round(quantity)));
}

function isLine(value: unknown): value is QuoteLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as QuoteLine;
  return (
    typeof line.productId === "string" &&
    line.productId.length > 0 &&
    Number.isFinite(line.quantity) &&
    line.quantity > 0
  );
}

/**
 * Storage is untrusted: anything a visitor (or a script) wrote there is
 * re-validated and clamped before it reaches the form.
 */
function read(): QuoteLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isLine)
      .slice(0, MAX_QUOTE_LINES)
      .map((line) => ({
        productId: line.productId,
        quantity: clampQuantity(line.quantity),
      }));
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

/**
 * Add a line, or raise the count on one already on the list.
 *
 * Returns `false` when a new line would exceed the list limit, so the caller
 * can say so instead of confirming an add that never happened.
 */
export function addLine(productId: string, quantity = 1): boolean {
  const requested = clampQuantity(quantity);
  const existing = state.lines.find((line) => line.productId === productId);

  if (existing) {
    write(
      state.lines.map((line) =>
        line.productId === productId
          ? { ...line, quantity: clampQuantity(line.quantity + requested) }
          : line,
      ),
    );
    return true;
  }

  if (state.lines.length >= MAX_QUOTE_LINES) return false;
  write([...state.lines, { productId, quantity: requested }]);
  return true;
}

export function setLineQuantity(productId: string, quantity: number): void {
  write(
    state.lines.map((line) =>
      line.productId === productId
        ? { ...line, quantity: clampQuantity(quantity) }
        : line,
    ),
  );
}

export function removeLine(productId: string): void {
  write(state.lines.filter((line) => line.productId !== productId));
}

export function clearLines(): void {
  write([]);
}

/**
 * Drop lines whose product no longer exists. Called by the resolver, which is
 * the only place that knows the live catalogue — the list self-heals the
 * first time the visitor opens their request.
 */
export function pruneLines(validIds: ReadonlySet<string>): void {
  const kept = state.lines.filter((line) => validIds.has(line.productId));
  if (kept.length !== state.lines.length) write(kept);
}
