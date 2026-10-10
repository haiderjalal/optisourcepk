"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import { formatPkr } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Pick a shop by typing part of its name, owner or area.
 *
 * Replaces a dropdown of every shop: with a long list, finding one meant
 * scrolling. Here a few letters are enough, and the balance is shown beside
 * each match so the choice is made with the number in view.
 *
 * Built as an ARIA combobox so screen readers and the keyboard get the same
 * behaviour a native select gives. The hidden input carries the chosen id into
 * the form. Props match what `Field` passes to its control.
 */

const MAX_OPTIONS = 40;

/** What the picker needs of a shop. The balance is shown only when given. */
export interface ShopOption {
  id: string;
  shop_name: string;
  customer_name: string;
  area: string;
  phone: string;
  balance?: number;
}

export function ShopPicker({
  id,
  name,
  className,
  required,
  defaultCustomerId,
  customers,
  onChange,
  ...aria
}: {
  id: string;
  name: string;
  className?: string;
  required?: boolean;
  defaultCustomerId?: string;
  customers: ShopOption[];
  onChange?: (customerId: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const initial = customers.find((c) => c.id === defaultCustomerId);
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [text, setText] = useState(initial ? labelOf(initial) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selected = customers.find((c) => c.id === selectedId);
  // Showing the chosen shop's own label means "not searching": list them all.
  const settled = selected !== undefined && text === labelOf(selected);
  const query = text.trim().toLowerCase();
  const options = (
    settled || query === ""
      ? customers
      : customers.filter((c) => haystack(c).includes(query))
  ).slice(0, MAX_OPTIONS);
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));
  const listId = `${id}-options`;
  const optionId = (index: number) => `${listId}-${index}`;

  function choose(shop: ShopOption) {
    setSelectedId(shop.id);
    setText(labelOf(shop));
    setOpen(false);
    onChange?.(shop.id);
  }

  function onType(value: string) {
    setText(value);
    setOpen(true);
    setActive(0);
    if (selectedId) {
      setSelectedId("");
      onChange?.("");
    }
  }

  function move(step: number) {
    if (options.length === 0) return;
    const next = (activeIndex + step + options.length) % options.length;
    setActive(next);
    document
      .getElementById(optionId(next))
      ?.scrollIntoView({ block: "nearest" });
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      move(-1);
    } else if (event.key === "Enter" && open && options[activeIndex]) {
      // Choosing from the list must not also submit the form.
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder="Type a shop, owner or area"
        value={text}
        required={required}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && options[activeIndex] ? optionId(activeIndex) : undefined
        }
        aria-required={required || undefined}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        onChange={(event) => onType(event.target.value)}
        onFocus={(event) => {
          // Select the text so the next keystroke starts a fresh search.
          event.currentTarget.select();
          setOpen(true);
        }}
        onKeyDown={onKey}
        className={cn(inputClass, "pr-10", className)}
      />
      <ChevronDown
        className="text-navy-300 pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input type="hidden" name={name} value={selectedId} />

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching shops"
          className="shadow-lift-lg absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl bg-white p-1 ring-1 ring-mist-200"
        >
          {options.length === 0 ? (
            <li className="text-navy-500 px-3 py-2.5 text-sm">
              No shop matches. Check the spelling, or add it as a new shop.
            </li>
          ) : (
            options.map((shop, index) => {
              const isActive = index === activeIndex;
              return (
                <li
                  key={shop.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={shop.id === selectedId}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(shop)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2.5",
                    isActive && "bg-accent-600/10",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {shop.shop_name}
                    </span>
                    <span className="text-navy-400 block truncate text-xs">
                      {[shop.customer_name, shop.area]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {shop.balance !== undefined && (
                    <span
                      className={cn(
                        "shrink-0 text-sm font-medium tabular-nums",
                        shop.balance > 0
                          ? "text-amber-700"
                          : shop.balance < 0
                            ? "text-emerald-700"
                            : "text-navy-400",
                      )}
                    >
                      {formatPkr(shop.balance)}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

function labelOf(shop: ShopOption): string {
  return shop.area ? `${shop.shop_name} · ${shop.area}` : shop.shop_name;
}

function haystack(shop: ShopOption): string {
  return [shop.shop_name, shop.customer_name, shop.area, shop.phone]
    .join(" ")
    .toLowerCase();
}
