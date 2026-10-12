"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info, Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuote } from "./useQuote";

type Feedback = "idle" | "added" | "full";

const FEEDBACK_MS = 1800;

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
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleAdd() {
    const added = add(product.id, quantity);
    setFeedback(added ? "added" : "full");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFeedback("idle"), FEEDBACK_MS);
  }

  const showingFeedback = feedback !== "idle";

  return (
    <Button
      type="button"
      onClick={handleAdd}
      variant={variant}
      size={size}
      className={className}
    >
      {/* Both labels sit in the same grid cell so the button keeps a stable
          width through the swap. The product name is visually hidden so the
          accessible name still contains the visible label. */}
      <span className="grid place-items-center">
        <span
          className={cn(
            "col-start-1 row-start-1 flex items-center gap-2 transition-opacity duration-150",
            showingFeedback ? "opacity-0" : "opacity-100",
          )}
        >
          <Plus className="size-4" aria-hidden />
          {label}
          <span className="sr-only">{product.name}</span>
        </span>
        <span
          aria-hidden={!showingFeedback}
          className={cn(
            "col-start-1 row-start-1 flex items-center gap-2 transition-opacity duration-150",
            showingFeedback ? "opacity-100" : "opacity-0",
          )}
        >
          {feedback === "full" ? (
            <Info className="size-4" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {feedback === "full" ? "List full" : "Added"}
        </span>
      </span>
      <span role="status" className="sr-only">
        {feedback === "added" && `${product.name} added to your request list.`}
        {feedback === "full" &&
          "Your request list is full. Remove a line to add another."}
      </span>
    </Button>
  );
}
