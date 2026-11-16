"use client";

import { useState } from "react";
import { AlertCircle, Check, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { describeBin } from "@/lib/format";

import type { Eye, Product, StockBin } from "@/types/database";

import { MAX_LABEL_COPIES } from "./config";
import { LabelPrintError, sendLabelJob } from "./printClient";
import {
  STOCK_FEATURES,
  stockDetailsFor,
  stockLabelLines,
  type StockFeature,
  type StockLabelDetails,
} from "./stockLabel";
import { buildLabelJob, buildTestLabelJob } from "./tspl";

type Status =
  | { kind: "idle" }
  | { kind: "printing" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/** The form's text as typed. It is checked only when a label is printed or previewed. */
interface Draft {
  brand: string;
  description: string;
  sph: string;
  cyl: string;
  addPower: string;
  eye: "" | Eye;
  abbe: string;
  index: string;
  size: string;
  colour: string;
  features: StockFeature[];
}

function draftFrom(details: StockLabelDetails): Draft {
  return {
    brand: details.brand,
    description: details.description,
    sph: details.sph === null ? "" : String(details.sph),
    cyl: details.cyl === null ? "" : String(details.cyl),
    addPower: details.addPower === null ? "" : String(details.addPower),
    eye: details.eye ?? "",
    abbe: details.abbe,
    index: details.index,
    size: details.size,
    colour: details.colour,
    features: details.features,
  };
}

/** A typed power: blank means none; anything else must be a number. */
function powerFrom(text: string): number | null | "invalid" {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : "invalid";
}

/** The label's details from the form, or null while a power is not a number. */
function detailsFrom(draft: Draft): StockLabelDetails | null {
  const sph = powerFrom(draft.sph);
  const cyl = powerFrom(draft.cyl);
  const addPower = powerFrom(draft.addPower);
  if (sph === "invalid" || cyl === "invalid" || addPower === "invalid") {
    return null;
  }
  return {
    brand: draft.brand,
    description: draft.description,
    sph,
    cyl,
    addPower,
    eye: draft.eye || null,
    abbe: draft.abbe,
    index: draft.index,
    size: draft.size,
    colour: draft.colour,
    features: draft.features,
  };
}

/** The preview shows each font at a size that reads like the sticker. */
const PREVIEW_CLASS: Record<string, string> = {
  "2": "text-[10px] leading-tight",
  "3": "text-xs leading-snug",
  "4": "text-base leading-snug",
  "5": "text-2xl font-bold leading-tight",
};

const POWER_ERROR = ["Enter a number, such as -0.25."];

/**
 * Print a stock lens box label for one power of a product.
 *
 * The power starts from the chosen stock bin. Every line on the label can be
 * changed before printing: the brand, the lens name, the power, Abbe, index,
 * size, colour and the features. A preview shows the label as it will read.
 *
 * Printing is manual, and the label is handed to the helper on this PC, which
 * passes it to the label printer — so it only prints from the PC the printer is
 * plugged into.
 */
export function LabelPrintPanel({
  product,
  bins,
}: {
  product: Product;
  bins: StockBin[];
}) {
  const [binId, setBinId] = useState(bins[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(() =>
    draftFrom(
      stockDetailsFor(
        product.name,
        bins[0] ?? { sph: null, cyl: null, add_power: null, eye: null },
      ),
    ),
  );
  const [copies, setCopies] = useState("1");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const bin = bins.find((candidate) => candidate.id === binId) ?? bins[0];
  if (!product.tracks_stock || !bin) return null;

  const count = Number(copies);
  const copiesValid =
    Number.isInteger(count) && count >= 1 && count <= MAX_LABEL_COPIES;
  const printing = status.kind === "printing";
  const details = detailsFrom(draft);
  const preview = details ? stockLabelLines(details) : null;

  function update(patch: Partial<Draft>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }

  /** Choosing another power fills the power fields from its bin; the rest is kept. */
  function chooseBin(id: string): void {
    setBinId(id);
    const next = bins.find((candidate) => candidate.id === id);
    if (!next) return;
    const power = draftFrom(stockDetailsFor(product.name, next));
    update({
      sph: power.sph,
      cyl: power.cyl,
      addPower: power.addPower,
      eye: power.eye,
    });
  }

  function toggleFeature(feature: StockFeature): void {
    setDraft((current) => ({
      ...current,
      features: current.features.includes(feature)
        ? current.features.filter((kept) => kept !== feature)
        : [...current.features, feature],
    }));
  }

  async function send(job: string, doneMessage: string): Promise<void> {
    setStatus({ kind: "printing" });
    try {
      await sendLabelJob(job);
      setStatus({ kind: "done", message: doneMessage });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof LabelPrintError
            ? error.message
            : "Could not print the label. Please try again.",
      });
    }
  }

  function printLabels(): void {
    if (!details || !copiesValid) return;
    let job: string;
    try {
      job = buildLabelJob(stockLabelLines(details), count);
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof RangeError
            ? error.message
            : "The label could not be built.",
      });
      return;
    }
    void send(
      job,
      `Sent ${count} ${count === 1 ? "label" : "labels"} to the printer.`,
    );
  }

  return (
    <form
      className="shadow-lift rounded-2xl bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        printLabels();
      }}
    >
      <h2 className="text-base font-semibold">Print labels</h2>
      <p className="text-navy-500 mt-1 text-sm">
        Box labels for the lens packets. They print on the label printer plugged
        into this PC.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field name="labelBin" label="Power">
          {(p) => (
            <select
              {...p}
              value={bin.id}
              onChange={(event) => chooseBin(event.target.value)}
            >
              {bins.map((option) => (
                <option key={option.id} value={option.id}>
                  {describeBin(option) || "No power"} · {option.qty_on_hand} on
                  hand
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          name="labelCopies"
          label="Labels to print"
          hint={`1 to ${MAX_LABEL_COPIES}`}
          errors={
            copiesValid
              ? undefined
              : [`Enter a number from 1 to ${MAX_LABEL_COPIES}.`]
          }
        >
          {(p) => (
            <input
              {...p}
              type="number"
              step="1"
              min={1}
              max={MAX_LABEL_COPIES}
              inputMode="numeric"
              value={copies}
              onChange={(event) => setCopies(event.target.value)}
            />
          )}
        </Field>
      </div>

      <h3 className="text-navy-600 mt-6 text-sm font-semibold">Lens</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Field
          name="labelBrand"
          label="Brand"
          hint="Printed large, e.g. UNI TOP."
        >
          {(p) => (
            <input
              {...p}
              type="text"
              maxLength={24}
              value={draft.brand}
              onChange={(event) => update({ brand: event.target.value })}
            />
          )}
        </Field>
        <Field
          name="labelDescription"
          label="Lens name"
          hint="Printed at the top, e.g. 1.56 BLUE CUT SHMC LENS."
        >
          {(p) => (
            <input
              {...p}
              type="text"
              maxLength={80}
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
            />
          )}
        </Field>
      </div>

      <h3 className="text-navy-600 mt-6 text-sm font-semibold">Power</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-4">
        <Field
          name="labelSph"
          label="SPH (DS)"
          errors={powerFrom(draft.sph) === "invalid" ? POWER_ERROR : undefined}
        >
          {(p) => (
            <input
              {...p}
              type="text"
              inputMode="decimal"
              value={draft.sph}
              onChange={(event) => update({ sph: event.target.value })}
            />
          )}
        </Field>
        <Field
          name="labelCyl"
          label="CYL (DC)"
          errors={powerFrom(draft.cyl) === "invalid" ? POWER_ERROR : undefined}
        >
          {(p) => (
            <input
              {...p}
              type="text"
              inputMode="decimal"
              value={draft.cyl}
              onChange={(event) => update({ cyl: event.target.value })}
            />
          )}
        </Field>
        <Field
          name="labelAdd"
          label="ADD"
          errors={
            powerFrom(draft.addPower) === "invalid" ? POWER_ERROR : undefined
          }
        >
          {(p) => (
            <input
              {...p}
              type="text"
              inputMode="decimal"
              value={draft.addPower}
              onChange={(event) => update({ addPower: event.target.value })}
            />
          )}
        </Field>
        <Field name="labelEye" label="Eye">
          {(p) => (
            <select
              {...p}
              value={draft.eye}
              onChange={(event) =>
                update({ eye: event.target.value as "" | Eye })
              }
            >
              <option value="">Not given</option>
              <option value="R">R</option>
              <option value="L">L</option>
            </select>
          )}
        </Field>
      </div>

      <h3 className="text-navy-600 mt-6 text-sm font-semibold">Details</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-4">
        <Field name="labelAbbe" label="Abbe">
          {(p) => (
            <input
              {...p}
              type="text"
              maxLength={12}
              value={draft.abbe}
              onChange={(event) => update({ abbe: event.target.value })}
            />
          )}
        </Field>
        <Field name="labelIndex" label="Index">
          {(p) => (
            <input
              {...p}
              type="text"
              maxLength={12}
              value={draft.index}
              onChange={(event) => update({ index: event.target.value })}
            />
          )}
        </Field>
        <Field name="labelSize" label="Size (mm)">
          {(p) => (
            <input
              {...p}
              type="text"
              maxLength={12}
              value={draft.size}
              onChange={(event) => update({ size: event.target.value })}
            />
          )}
        </Field>
        <Field name="labelColour" label="Colour">
          {(p) => (
            <input
              {...p}
              type="text"
              maxLength={16}
              value={draft.colour}
              onChange={(event) => update({ colour: event.target.value })}
            />
          )}
        </Field>
      </div>

      <fieldset className="mt-6">
        <legend className="text-navy-600 text-sm font-semibold">
          Features on the box
        </legend>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {STOCK_FEATURES.map((feature) => (
            <label
              key={feature.key}
              className="text-navy-700 inline-flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                className="size-4"
                checked={draft.features.includes(feature.key)}
                onChange={() => toggleFeature(feature.key)}
              />
              {feature.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <p className="text-navy-600 text-sm font-semibold">Preview</p>
        {preview ? (
          <div
            aria-label="Label preview"
            className="text-navy-800 mt-2 w-full max-w-sm rounded-lg border-2 border-dashed border-mist-300 bg-white p-4"
          >
            {preview.map((line, index) => (
              <div
                key={index}
                className={`${PREVIEW_CLASS[line.font.id] ?? ""} ${line.align === "center" ? "text-center" : ""} font-mono`}
                style={{ paddingBottom: line.gapAfterDots ? 6 : 0 }}
              >
                {line.text}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-amber-700">
            Enter each power as a number, such as -0.25, to see the preview.
          </p>
        )}
        <p className="text-navy-400 mt-2 text-xs">
          The printer draws its own letters, so the sticker will not match this
          preview exactly.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={printing || !copiesValid || !details}>
          <Printer className="size-4" aria-hidden />
          {printing ? "Printing…" : "Print labels"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={printing}
          onClick={() =>
            void send(buildTestLabelJob(), "Sent a test label to the printer.")
          }
        >
          Print a test label
        </Button>

        {status.kind === "done" && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-emerald-700"
          >
            <Check className="size-4" aria-hidden />
            {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-amber-700"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
