"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuote } from "./useQuote";

/**
 * Adds a product to the visitor's request list. Confirms inline for a beat
 * rather than firing a toast — the feedback belongs where the click happened.
 *
 * The swap is a CSS cross-fade: this button renders on every catalogue card,
 * so it must not drag an animation library onto the page.
 */
export function AddToQuoteButton({
  product,
  quantity,
  variant = "primary",
  size = "sm",
  className,
  label = "Add to request",
}: {
  /** Only what the button needs — passing the whole record bloats the payload. */
  product: { id: string; name: string };
  quantity?: number;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
}) {
  const { add } = useQuote();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleAdd() {
    add(product.id, quantity);
    setJustAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setJustAdded(false), 1800);
  }

  return (
    <Button
      type="button"
      onClick={handleAdd}
      variant={variant}
      size={size}
      className={className}
      aria-label={`Add ${product.name} to your request list`}
    >
      {/* Both labels sit in the same grid cell so the button keeps a stable
          width through the swap. */}
      <span className="grid place-items-center">
        <span
          className={cn(
            "col-start-1 row-start-1 flex items-center gap-2 transition-opacity duration-150",
            justAdded ? "opacity-0" : "opacity-100",
          )}
        >
          <Plus className="size-4" aria-hidden />
          {label}
        </span>
        <span
          aria-hidden={!justAdded}
          className={cn(
            "col-start-1 row-start-1 flex items-center gap-2 transition-opacity duration-150",
            justAdded ? "opacity-100" : "opacity-0",
          )}
        >
          <Check className="size-4" aria-hidden />
          Added
        </span>
      </span>
    </Button>
  );
}
