import { ArrowRight, Check, FlaskConical, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { RxStage } from "@/types/database";
import { setRxStageAction } from "./actions";

/**
 * Where an RX order is with the lab, and the button for the next step.
 *
 * booked -> sent to lab -> back from lab. Each step can be undone until the
 * invoice is issued; after that the stage is final and only shown.
 */

const LABEL: Record<RxStage, string> = {
  booked: "Booked",
  sent: "At the lab",
  back: "Back from lab",
};

const NEXT: Record<RxStage, { stage: RxStage; label: string } | null> = {
  booked: { stage: "sent", label: "Sent to lab" },
  sent: { stage: "back", label: "Back from lab" },
  back: null,
};

const PREVIOUS: Record<RxStage, RxStage | null> = {
  booked: null,
  sent: "booked",
  back: "sent",
};

export function RxStageControl({
  orderId,
  stage,
  sentAt,
  backAt,
  final,
  compact = false,
}: {
  orderId: string;
  stage: RxStage;
  sentAt: string | null;
  backAt: string | null;
  /** Invoiced or void: show the stage, offer nothing. */
  final: boolean;
  compact?: boolean;
}) {
  const next = NEXT[stage];
  const previous = PREVIOUS[stage];
  const when = stage === "back" ? backAt : stage === "sent" ? sentAt : null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${compact ? "justify-end" : ""}`}
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
          stage === "back"
            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
            : stage === "sent"
              ? "bg-sky-50 text-sky-800 ring-sky-200"
              : "text-navy-700 bg-mist-100 ring-mist-300"
        }`}
      >
        {stage === "back" ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <FlaskConical className="size-3.5" aria-hidden />
        )}
        {LABEL[stage]}
        {when && <span className="font-normal">· {formatDate(when)}</span>}
      </span>

      {!final && next && (
        <form action={setRxStageAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="stage" value={next.stage} />
          <button
            type="submit"
            className="bg-accent-600 hover:bg-accent-700 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-colors"
          >
            {next.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
        </form>
      )}

      {!final && previous && (
        <form action={setRxStageAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="stage" value={previous} />
          <button
            type="submit"
            className="text-navy-400 hover:text-navy-600 rounded p-1 transition-colors hover:bg-mist-100"
            title={`Undo — back to ${LABEL[previous].toLowerCase()}`}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            <span className="sr-only">
              Undo, back to {LABEL[previous].toLowerCase()}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}
