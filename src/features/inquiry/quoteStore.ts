import type { QuoteLine } from "@/types/catalogue";

const STORAGE_KEY = "optisource.quote.v2";

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
 *
 * This module deliberately imports NOTHING from `@/data`. The header reads it
 * on every page just to render a badge count, so pulling the catalogue in here
 * would ship the whole product list to every visitor. Each line therefore
 * carries its own minimum order quantity, captured when it was added, and
 * catalogue resolution lives in `useQuoteItems`.
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

function isLine(value: unknown): value is QuoteLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as QuoteLine;
  return (
    typeof line.productId === "string" &&
    line.productId.length > 0 &&
    Number.isFinite(line.quantity) &&
    line.quantity > 0 &&
    Number.isFinite(line.moq) &&
    line.moq > 0
  );
}

function read(): QuoteLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLine).slice(0, MAX_QUOTE_LINES);
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

export function addLine(productId: string, moq: number, quantity = moq): void {
  const requested = Math.max(moq, Math.round(quantity));
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
  write([...state.lines, { productId, quantity: requested, moq }]);
}

export function setLineQuantity(productId: string, quantity: number): void {
  write(
    state.lines.map((line) =>
      line.productId === productId
        ? // Never let a line fall below the minimum we can quote against.
          { ...line, quantity: Math.max(line.moq, Math.round(quantity)) }
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
