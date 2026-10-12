"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { savePairPatient } from "./actions";

/**
 * The optional patient for one pair, typed straight into the order's table.
 *
 * Blank is a valid answer: saving an empty name clears it, so a pair can be
 * named now, renamed later, or left without one.
 */
export function PairPatientForm({
  orderId,
  lineIds,
  patientName,
}: {
  orderId: string;
  /** The lines of the pair (two) or of a lone eye (one). */
  lineIds: string[];
  patientName: string;
}) {
  const [state, formAction] = useActionState(savePairPatient, {});
  const inputId = useId();

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="lineIds" value={JSON.stringify(lineIds)} />

      <label htmlFor={inputId} className="text-navy-500 text-xs font-medium">
        Patient <span className="text-navy-400 font-normal">(optional)</span>
      </label>
      <input
        id={inputId}
        name="patientName"
        type="text"
        maxLength={120}
        defaultValue={patientName}
        placeholder="Patient name"
        className={cn(inputClass, "h-9 max-w-xs py-1.5")}
      />
      <SaveButton />

      <span role="status" className="text-navy-400 text-xs">
        {state.saved ? "Saved" : null}
      </span>
      {state.error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}
