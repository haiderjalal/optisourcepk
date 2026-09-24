"use client";

import { useSyncExternalStore } from "react";
import type { SheetLayout } from "./orientation";

/**
 * One remembered layout, shared by the stock sheet and the receiving grid, so
 * swapping one swaps both.
 *
 * Kept in localStorage: it is a per-person viewing preference, not data. When
 * storage is unavailable the choice still holds until the page is reloaded.
 */

const KEY = "optisource:sheet-layout";
const EVENT = "optisource:sheet-layout";
let memory: SheetLayout | null = null;

function read(): SheetLayout | null {
  try {
    const value = window.localStorage.getItem(KEY);
    if (value === "sph-down" || value === "sph-across") return value;
  } catch {
    // Private mode or blocked storage: fall back to this tab's choice.
  }
  return memory;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** The remembered layout, or `fallback` until the person picks one. */
export function useSheetLayout(
  fallback: SheetLayout,
): [SheetLayout, () => void] {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const layout = stored ?? fallback;

  function toggle() {
    const next: SheetLayout = layout === "sph-down" ? "sph-across" : "sph-down";
    memory = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Held in memory instead.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return [layout, toggle];
}
