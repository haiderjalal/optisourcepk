"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Wallet } from "lucide-react";
import {
  findShopsAction,
  type ShopMatch,
} from "@/features/shop/customers/actions";
import { formatPkr } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Find a shop by its name or its owner's, and act on it in the same place.
 *
 * Typing lists the matches with their balance. Enter opens the first one's
 * statement, and each row carries the two things done most often for a shop:
 * taking a payment and sending its invoices. "/" focuses the field from
 * anywhere on the back-office.
 */

const MIN_TERM = 2;
const DEBOUNCE_MS = 180;

interface Results {
  term: string;
  shops: ShopMatch[];
  failed: boolean;
}

export function ShopFinder() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Results | null>(null);

  const term = query.trim();
  const searchable = term.length >= MIN_TERM;
  // Results only count for the exact term they were fetched for, so a slow
  // answer can never show under a newer query.
  const current = results?.term === term ? results : null;

  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      findShopsAction(term)
        .then((shops) => {
          if (!cancelled) setResults({ term, shops, failed: false });
        })
        .catch(() => {
          if (!cancelled) setResults({ term, shops: [], failed: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, searchable]);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function close() {
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const first = current?.shops[0];
    if (first) {
      router.push(`/shop/customers/${first.id}/statement`);
    } else if (term) {
      router.push(`/shop/customers?q=${encodeURIComponent(term)}`);
    }
    close();
    inputRef.current?.blur();
  }

  function onInputKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setQuery("");
      close();
    }
    if (event.key === "ArrowDown") {
      const first = listRef.current?.querySelector<HTMLAnchorElement>("a");
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const showPanel = open && searchable;

  return (
    <form
      role="search"
      onSubmit={submit}
      className="relative w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          close();
        }
      }}
    >
      <label htmlFor="shop-finder" className="sr-only">
        Find a shop or owner
      </label>
      <Search
        className="text-navy-300 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        ref={inputRef}
        id="shop-finder"
        type="search"
        autoComplete="off"
        value={query}
        placeholder="Find a shop or owner"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKey}
        className="placeholder:text-navy-300 focus:border-accent-600 h-11 w-full rounded-full border border-mist-300 bg-mist-50 pr-12 pl-10 text-sm transition-colors outline-none focus:bg-white"
      />
      <kbd
        aria-hidden
        className="text-navy-400 pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-mist-300 bg-white px-1.5 py-0.5 font-mono text-[0.6875rem] sm:block"
      >
        /
      </kbd>

      {showPanel && (
        <div
          id="shop-finder-results"
          ref={listRef}
          className="shadow-lift-lg absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl bg-white p-2 ring-1 ring-mist-200"
        >
          <Panel current={current} term={term} />
        </div>
      )}
    </form>
  );
}

function Panel({ current, term }: { current: Results | null; term: string }) {
  if (!current) {
    return <p className="text-navy-500 px-3 py-4 text-sm">Searching…</p>;
  }

  if (current.failed) {
    return (
      <p role="alert" className="px-3 py-4 text-sm text-amber-800">
        Search is unavailable right now. Try again in a moment.
      </p>
    );
  }

  if (current.shops.length === 0) {
    return (
      <div className="px-3 py-4 text-sm">
        <p className="text-navy-600">No shop matches &ldquo;{term}&rdquo;.</p>
        <Link
          href="/shop/customers/new"
          className="text-accent-700 hover:text-accent-800 mt-2 inline-flex items-center gap-1.5 font-medium"
        >
          <Plus className="size-4" aria-hidden />
          Add it as a new shop
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-mist-100">
      {current.shops.map((shop) => (
        <li
          key={shop.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3"
        >
          <Link
            href={`/shop/customers/${shop.id}/statement`}
            className="group min-w-0 flex-1 rounded-lg"
          >
            <p className="group-hover:text-accent-700 truncate font-medium">
              {shop.shopName}
            </p>
            <p className="text-navy-500 truncate text-xs">
              {[shop.ownerName, shop.area].filter(Boolean).join(" · ")}
            </p>
          </Link>

          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              shop.balance > 0
                ? "text-amber-700"
                : shop.balance < 0
                  ? "text-emerald-700"
                  : "text-navy-400",
            )}
          >
            {formatPkr(shop.balance)}
          </span>

          <div className="flex gap-1.5">
            <Link
              href={`/shop/payments?customer=${shop.id}`}
              className="bg-accent-600 hover:bg-accent-700 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white transition-colors"
            >
              <Wallet className="size-3.5" aria-hidden />
              Collect
            </Link>
            <Link
              href={`/shop/customers/${shop.id}/invoices/pdf?download`}
              prefetch={false}
              className="text-navy-600 ring-navy-200 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium ring-1 transition-colors ring-inset hover:bg-mist-100"
            >
              <FileText className="size-3.5" aria-hidden />
              PDF
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
