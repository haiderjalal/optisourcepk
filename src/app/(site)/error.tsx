"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/button";
import { CONTACT } from "@/lib/site";

/**
 * Route-level error boundary. Shows a friendly message and a retry; the
 * underlying error is reported to the console for the platform log drain and
 * never rendered to the visitor.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Unhandled route error",
        digest: error.digest,
        at: new Date().toISOString(),
      }),
    );
  }, [error]);

  return (
    <section className="container-brand flex min-h-[60svh] flex-col items-center justify-center py-20 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-amber-50 ring-1 ring-amber-200 ring-inset">
        <AlertTriangle className="size-6 text-amber-700" aria-hidden />
      </span>
      <h1 className="mt-6 text-3xl font-bold">Something went wrong.</h1>
      <p className="text-navy-500 mt-4 max-w-md leading-relaxed">
        We could not load this page. Try again — and if it keeps happening,
        please call the trade desk and we will sort it out directly.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" onClick={reset}>
          <RotateCw className="size-4" aria-hidden />
          Try again
        </Button>
        <ButtonLink href={CONTACT.phoneHref} variant="outline" size="lg">
          Call {CONTACT.phone}
        </ButtonLink>
      </div>

      {error.digest && (
        <p className="text-navy-300 mt-8 text-xs">Reference {error.digest}</p>
      )}
    </section>
  );
}
