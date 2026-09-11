"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PackageSearch, Search, X } from "lucide-react";
import { ProductCard } from "@/components/shared/ProductCard";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/data/categories";
import { cn } from "@/lib/utils";
import type { CategorySlug, Product } from "@/types/catalogue";

type SortKey = "featured" | "price-asc" | "price-desc" | "moq-asc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Most requested" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "moq-asc", label: "Lowest minimum order" },
];

/**
 * Client-side catalogue filtering.
 *
 * The catalogue is a few dozen static lines, so filtering in the browser is
 * instant and costs no round trip. Move this to `searchParams` + a server
 * query once the list is long enough to paginate.
 */
export function CatalogueBrowser({
  products,
  /** Hidden when the page is already scoped to one category. */
  showCategoryFilter = true,
  ranges,
}: {
  products: Product[];
  showCategoryFilter?: boolean;
  ranges?: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategorySlug | "all">("all");
  const [range, setRange] = useState<string | "all">("all");
  const [sort, setSort] = useState<SortKey>("featured");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      if (range !== "all" && product.range !== range) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        product.tagline.toLowerCase().includes(needle) ||
        product.range.toLowerCase().includes(needle) ||
        product.description.toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.indicativePrice - b.indicativePrice;
        case "price-desc":
          return b.indicativePrice - a.indicativePrice;
        case "moq-asc":
          return a.moq - b.moq;
        default:
          return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      }
    });
  }, [products, query, category, range, sort]);

  const hasFilters = query !== "" || category !== "all" || range !== "all";

  function reset() {
    setQuery("");
    setCategory("all");
    setRange("all");
  }

  return (
    <div>
      {/* Controls */}
      <div className="border-navy-100 sticky top-16 z-30 -mx-5 border-y bg-mist-100/88 px-5 py-4 backdrop-blur-lg lg:top-[4.5rem] lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search
              className="text-navy-300 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lenses, frames, consumables…"
              aria-label="Search the catalogue"
              className="border-navy-200 text-navy-700 placeholder:text-navy-300 hover:border-navy-300 focus:border-accent-600 h-11 w-full rounded-full border bg-white pr-4 pl-10 text-sm transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-navy-400 flex items-center gap-2 text-xs">
              <span className="hidden sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Sort products"
                className="border-navy-200 text-navy-700 hover:border-navy-300 h-11 rounded-full border bg-white px-4 text-sm transition-colors"
              >
                {SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <X className="size-3.5" aria-hidden />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        {(showCategoryFilter || ranges) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <FilterChip
              active={showCategoryFilter ? category === "all" : range === "all"}
              onClick={() =>
                showCategoryFilter ? setCategory("all") : setRange("all")
              }
            >
              All
            </FilterChip>

            {showCategoryFilter
              ? CATEGORIES.map((entry) => (
                  <FilterChip
                    key={entry.slug}
                    active={category === entry.slug}
                    onClick={() => setCategory(entry.slug)}
                  >
                    {entry.name}
                  </FilterChip>
                ))
              : ranges?.map((entry) => (
                  <FilterChip
                    key={entry}
                    active={range === entry}
                    onClick={() => setRange(entry)}
                  >
                    {entry}
                  </FilterChip>
                ))}
          </div>
        )}
      </div>

      <p
        className="text-navy-400 mt-8 text-sm"
        role="status"
        aria-live="polite"
      >
        Showing {visible.length} of {products.length} lines
      </p>

      {visible.length > 0 ? (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((product) => (
              <motion.li
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProductCard product={product} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="rounded-card border-navy-200 mt-6 border border-dashed bg-white/60 px-6 py-16 text-center">
          <span className="bg-navy-50 mx-auto grid size-12 place-items-center rounded-full">
            <PackageSearch className="text-navy-400 size-5" aria-hidden />
          </span>
          <h3 className="mt-5 text-lg font-semibold">Nothing matches that.</h3>
          <p className="text-navy-500 mx-auto mt-2 max-w-sm text-sm">
            We stock well beyond what is listed here. Tell us what you are
            looking for and we will confirm whether we can source it.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              Clear filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-navy-700 text-white"
          : "text-navy-500 ring-navy-200 hover:text-navy-700 hover:ring-navy-300 bg-white ring-1 ring-inset",
      )}
    >
      {children}
    </button>
  );
}
