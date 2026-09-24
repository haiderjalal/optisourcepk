"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Check, PackageMinus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { describeBin } from "@/lib/format";
import { sphPlaceholder } from "@/lib/power";
import { STOCK_REASONS } from "@/lib/validations/shop/stock";
import type { Product, StockBin } from "@/types/database";
import { adjustStockAction, type StockFormState } from "./actions";

type Mode = "add" | "remove";

function Submit({ mode, disabled }: { mode: Mode; disabled: boolean }) {
  const { pending } = useFormStatus();
  const Icon = mode === "add" ? PackagePlus : PackageMinus;
  return (
    <Button
      type="submit"
      variant={mode === "add" ? "primary" : "navy"}
      disabled={pending || disabled}
    >
      <Icon className="size-4" aria-hidden />
      {pending
        ? "Applying…"
        : mode === "add"
          ? "Add to stock"
          : "Remove from stock"}
    </Button>
  );
}

/** A blank or zero CYL / ADD is the same shelf position as none. */
const norm = (v: string) =>
  v.trim() === "" || Number(v) === 0 ? null : Number(v);

/**
 * Add or remove stock one power at a time, without leaving the stock screen.
 *
 * Removing is for breakage, a count that came up short, or goods sent back
 * to a supplier. The quantity is typed as a plain number and signed here, and
 * the count on hand for the chosen power is shown before submitting, so
 * taking out more than is there is caught before the database refuses it.
 *
 * Every field is controlled: React resets uncontrolled fields once a form
 * action finishes, which wiped the form whenever a save failed.
 */
export function QuickReceive({
  products,
  bins,
}: {
  products: Product[];
  bins: StockBin[];
}) {
  const [state, formAction] = useActionState<StockFormState, FormData>(
    adjustStockAction,
    {},
  );
  const [mode, setMode] = useState<Mode>("add");
  const [productId, setProductId] = useState("");
  const [sph, setSph] = useState("");
  const [cyl, setCyl] = useState("");
  const [addPower, setAddPower] = useState("");
  const [eye, setEye] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("purchase");
  const [alertQty, setAlertQty] = useState("");
  const [note, setNote] = useState("");

  const product = products.find((p) => p.id === productId);
  const errors = state.fieldErrors;

  if (products.length === 0) return null;

  // SPH is kept as typed: 0.00 is plano, a real power, not "none".
  const sphValue = sph.trim() === "" ? null : Number(sph);

  // The bin this form is pointing at, as the database will match it.
  const bin = product
    ? bins.find(
        (b) =>
          b.product_id === product.id &&
          b.sph === (product.tracks_power ? sphValue : null) &&
          b.cyl === norm(cyl) &&
          b.add_power === norm(addPower) &&
          (b.eye ?? "") === eye,
      )
    : undefined;
  const onHand = bin?.qty_on_hand ?? 0;
  const amount = Math.abs(Math.trunc(Number(qty) || 0));
  const tooMany = mode === "remove" && product !== undefined && amount > onHand;

  function switchMode(next: Mode) {
    setMode(next);
    setReason(next === "add" ? "purchase" : "adjustment");
  }

  const powerPicked = !product?.tracks_power || sph.trim() !== "";

  return (
    <form
      action={formAction}
      className="shadow-lift mb-5 rounded-2xl bg-white p-5"
    >
      <input
        type="hidden"
        name="delta"
        value={mode === "remove" ? -amount : amount}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {mode === "add" ? "Receive stock" : "Remove stock"}
        </h2>
        <div
          role="radiogroup"
          aria-label="Add or remove stock"
          className="inline-flex rounded-lg bg-mist-100 p-1 text-sm font-medium"
        >
          {(["add", "remove"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => switchMode(m)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                mode === m
                  ? m === "add"
                    ? "bg-accent-600 text-white"
                    : "bg-navy-700 text-white"
                  : "text-navy-600 hover:text-navy-800"
              }`}
            >
              {m === "add" ? "Add stock" : "Remove stock"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-navy-500 mt-1 max-w-prose text-sm">
        {mode === "add" ? (
          <>
            Add stock one power at a time. Fill in only the values that divide
            your shelf. For a supplier delivery,{" "}
            <Link
              href="/shop/purchases/new"
              className="text-accent-600 hover:text-accent-700 font-medium"
            >
              record the purchase invoice
            </Link>{" "}
            instead, so you know where it came from.
          </>
        ) : (
          "Take stock out for breakage, a short count, or goods sent back to a supplier. Pick the exact power; the count on hand shows before you remove."
        )}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          name="productId"
          label="Product"
          required
          className="lg:col-span-2"
          errors={errors?.productId}
        >
          {(p) => (
            <select
              {...p}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select a product…</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field name="sph" label="SPH" hint="0.25 steps" errors={errors?.sph}>
          {(p) => (
            <input
              {...p}
              type="number"
              step={product?.sph_step ?? 0.25}
              min={product?.sph_min ?? -30}
              max={product?.sph_max ?? 30}
              inputMode="decimal"
              placeholder={sphPlaceholder(product?.lens_sign)}
              value={sph}
              onChange={(e) => setSph(e.target.value)}
            />
          )}
        </Field>

        <Field name="cyl" label="CYL" hint="0.25 steps" errors={errors?.cyl}>
          {(p) => (
            <input
              {...p}
              type="number"
              step={product?.cyl_step ?? 0.25}
              min={product?.cyl_min ?? -12}
              max={product?.cyl_max ?? 12}
              inputMode="decimal"
              placeholder="-0.50"
              value={cyl}
              onChange={(e) => setCyl(e.target.value)}
            />
          )}
        </Field>

        <Field name="addPower" label="ADD" errors={errors?.addPower}>
          {(p) => (
            <input
              {...p}
              type="number"
              step={product?.add_step ?? 0.25}
              min={product?.add_min ?? 0}
              max={product?.add_max ?? 6}
              inputMode="decimal"
              placeholder="+1.50"
              value={addPower}
              onChange={(e) => setAddPower(e.target.value)}
            />
          )}
        </Field>

        <Field name="eye" label="Eye" errors={errors?.eye}>
          {(p) => (
            <select {...p} value={eye} onChange={(e) => setEye(e.target.value)}>
              <option value="">Either</option>
              <option value="R">Right</option>
              <option value="L">Left</option>
            </select>
          )}
        </Field>

        <Field
          name="qty"
          label={`${mode === "add" ? "Quantity to add" : "Quantity to remove"} (${product?.unit ?? "pcs"})`}
          required
          errors={errors?.delta}
        >
          {(p) => (
            <input
              {...p}
              type="number"
              step="1"
              min={1}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          )}
        </Field>

        {mode === "add" && (
          <Field
            name="alertQty"
            label="Alert quantity"
            hint="Warn at or below this"
            errors={errors?.alertQty}
          >
            {(p) => (
              <input
                {...p}
                type="number"
                step="1"
                min={0}
                inputMode="numeric"
                placeholder="Leave blank to keep"
                value={alertQty}
                onChange={(e) => setAlertQty(e.target.value)}
              />
            )}
          </Field>
        )}

        <Field name="reason" label="Reason" required errors={errors?.reason}>
          {(p) =>
            mode === "add" ? (
              <select
                {...p}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {STOCK_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                {...p}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="adjustment">Write-off / correction</option>
              </select>
            )
          }
        </Field>

        <Field name="note" label="Note" errors={errors?.note}>
          {(p) => (
            <input
              {...p}
              type="text"
              placeholder={
                mode === "add"
                  ? "Supplier, invoice no."
                  : "Broken, short count, sent back…"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      </div>

      {product && powerPicked && (
        <p
          className={`mt-4 text-sm ${tooMany ? "text-amber-700" : "text-navy-600"}`}
        >
          On hand
          {bin && describeBin(bin) ? ` at ${describeBin(bin)}` : ""}:{" "}
          <span className="font-semibold tabular-nums">
            {onHand} {product.unit}
          </span>
          {mode === "remove" &&
            (tooMany
              ? ` — you can remove at most ${onHand}.`
              : amount > 0
                ? ` → ${onHand - amount} after removing.`
                : "")}
          {!bin && " (nothing held at this exact power)"}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Submit mode={mode} disabled={amount === 0 || tooMany} />

        {state.message && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-emerald-700"
          >
            <Check className="size-4" aria-hidden />
            {state.message}
          </p>
        )}
        {state.error && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-amber-700"
          >
            <AlertCircle className="size-4" aria-hidden />
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
