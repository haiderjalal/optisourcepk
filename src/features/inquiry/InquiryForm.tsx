"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { CONTACT } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  BUSINESS_TYPES,
  inquirySchema,
  type InquiryInput,
} from "@/lib/validations/inquiry";
import { useQuoteItems } from "./useQuoteItems";
import type { ApiResponse } from "@/types/api";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; reference?: string; message: string }
  | { kind: "failed"; message: string };

export function InquiryForm() {
  const { lines, count, clear } = useQuoteItems();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const formId = useId();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InquiryInput>({
    // Same schema the route handler runs — the client can only ever be a
    // faster copy of the server's rules, never a different set.
    resolver: zodResolver(inquirySchema),
    defaultValues: { businessType: "practice", notes: "", company: "" },
  });

  async function onSubmit(values: InquiryInput) {
    setStatus({ kind: "sending" });

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, lines }),
      });

      const body = (await response.json()) as ApiResponse<{
        reference: string;
      }>;

      if (!response.ok || !body.success) {
        setStatus({
          kind: "failed",
          message:
            body.message ??
            "We could not submit your inquiry. Please try again.",
        });
        return;
      }

      setStatus({
        kind: "sent",
        reference: body.data?.reference,
        message: body.message,
      });
      reset();
      clear();
    } catch {
      setStatus({
        kind: "failed",
        message:
          "We could not reach the server. Check your connection, or send us a WhatsApp message instead.",
      });
    }
  }

  if (status.kind === "sent") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-card border border-emerald-200 bg-emerald-50/60 p-8 text-center"
        role="status"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-600/10">
          <CheckCircle2 className="size-7 text-emerald-700" aria-hidden />
        </span>
        <h2 className="mt-5 text-xl font-bold">Inquiry received.</h2>
        <p className="text-navy-600 mx-auto mt-3 max-w-md text-sm leading-relaxed">
          {status.message}
        </p>
        {status.reference && (
          <p className="font-display text-navy-700 mt-5 inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold tracking-wide ring-1 ring-emerald-200 ring-inset">
            Reference {status.reference}
          </p>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/catalogue" variant="outline" size="sm">
            Back to the catalogue
          </ButtonLink>
          <ButtonLink
            href={CONTACT.whatsappHref}
            variant="ghost"
            size="sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Message us on WhatsApp
          </ButtonLink>
        </div>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-card border-navy-100 border bg-white p-6 sm:p-8"
    >
      <h2 className="text-xl font-bold">Your details</h2>
      <p className="text-navy-500 mt-2 text-sm">
        We supply the trade only. Tell us about your business and we will come
        back with a written quotation
        {count > 0
          ? ` covering the ${count} ${count === 1 ? "line" : "lines"} on your list`
          : ""}
        .
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field
          id={`${formId}-contactName`}
          label="Your name"
          error={errors.contactName?.message}
        >
          {(a11y) => (
            <input
              {...register("contactName")}
              {...a11y}
              autoComplete="name"
              className={inputClass(Boolean(errors.contactName))}
            />
          )}
        </Field>

        <Field
          id={`${formId}-businessName`}
          label="Practice or business name"
          error={errors.businessName?.message}
        >
          {(a11y) => (
            <input
              {...register("businessName")}
              {...a11y}
              autoComplete="organization"
              className={inputClass(Boolean(errors.businessName))}
            />
          )}
        </Field>

        <Field
          id={`${formId}-email`}
          label="Email"
          error={errors.email?.message}
        >
          {(a11y) => (
            <input
              {...register("email")}
              {...a11y}
              type="email"
              inputMode="email"
              autoComplete="email"
              className={inputClass(Boolean(errors.email))}
            />
          )}
        </Field>

        <Field
          id={`${formId}-phone`}
          label="Phone"
          hint="Mobile or landline — we may call to confirm."
          error={errors.phone?.message}
        >
          {(a11y) => (
            <input
              {...register("phone")}
              {...a11y}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0300 1234567"
              className={inputClass(Boolean(errors.phone))}
            />
          )}
        </Field>

        <Field id={`${formId}-city`} label="City" error={errors.city?.message}>
          {(a11y) => (
            <input
              {...register("city")}
              {...a11y}
              autoComplete="address-level2"
              placeholder="Islamabad"
              className={inputClass(Boolean(errors.city))}
            />
          )}
        </Field>

        <Field
          id={`${formId}-businessType`}
          label="Type of business"
          error={errors.businessType?.message}
        >
          {(a11y) => (
            <select
              {...register("businessType")}
              {...a11y}
              className={inputClass(Boolean(errors.businessType))}
            >
              {BUSINESS_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="mt-5">
        <Field
          id={`${formId}-notes`}
          label="What do you need?"
          hint="Powers, quantities, brands, timelines — anything that helps us quote accurately."
          error={errors.notes?.message}
        >
          {(a11y) => (
            <textarea
              {...register("notes")}
              {...a11y}
              rows={5}
              className={cn(inputClass(Boolean(errors.notes)), "h-auto py-3")}
            />
          )}
        </Field>
      </div>

      {/* Honeypot — hidden from people, irresistible to scripts. */}
      <div className="absolute h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor={`${formId}-company`}>Company</label>
        <input
          {...register("company")}
          id={`${formId}-company`}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div aria-live="assertive">
        <AnimatePresence>
          {status.kind === "failed" && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex items-start gap-2.5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {status.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden />
              Send trade inquiry
            </>
          )}
        </Button>
        <p className="text-navy-400 text-xs">
          No payment is taken on this site. We reply by email or phone within
          one working day.
        </p>
      </div>
    </form>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    "h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-navy-700 transition-colors placeholder:text-navy-300",
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-navy-200 hover:border-navy-300 focus:border-accent-600",
  );
}

interface FieldA11y {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

/**
 * Label + control + message, wired together.
 *
 * The control is supplied as a render prop so the field can hand it the
 * `aria-invalid` / `aria-describedby` pair — a validation message a screen
 * reader cannot reach is not a validation message.
 */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (props: FieldA11y) => React.ReactNode;
}) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="text-navy-600 block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5">
        {children({
          id,
          "aria-invalid": Boolean(error),
          "aria-describedby": messageId,
        })}
      </div>
      {error ? (
        <p
          id={messageId}
          className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-navy-400 mt-1.5 text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
