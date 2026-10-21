"use client";

import { useMemo, useState } from "react";
import { Download, MessageCircle, Printer } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { pdfFileName } from "@/features/shop/pdf/pdfResponse";
import {
  createPdfLoader,
  isAbortError,
  printPdfFile,
  sharePdfFile,
} from "@/features/shop/pdf/sharePdf";
import { formatDate } from "@/lib/format";
import { whatsappLink } from "./whatsapp";

/**
 * Print, share or download the RX lab report for its date range. Every action
 * uses the same server-rendered PDF, so what is printed is what is sent.
 *
 * WhatsApp works as the stock sheet does: on a phone the share sheet sends the
 * PDF itself. Where the browser cannot share files, the PDF is downloaded and a
 * WhatsApp chat opens for it to be attached to.
 */
export function RxLabReportActions({ from, to }: { from: string; to: string }) {
  const url = `/shop/rx-lab-report/pdf?${new URLSearchParams({ from, to })}`;
  const fileName = pdfFileName("RX-Lab-Report", `${from} to ${to}`);
  const text = `OptiSource PK — RX lab report, ${formatDate(from)} to ${formatDate(to)}`;
  const loader = useMemo(() => createPdfLoader(url, fileName), [url, fileName]);
  const [busy, setBusy] = useState<"print" | "share" | null>(null);
  const [status, setStatus] = useState<{
    tone: "ok" | "error";
    text: string;
  }>();

  async function print() {
    setBusy("print");
    setStatus(undefined);
    try {
      printPdfFile(await loader.load(), "rx-lab-report-print");
    } catch (caught) {
      setStatus({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Could not prepare the report to print.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setStatus(undefined);
    try {
      const file = await loader.load();
      const outcome = await sharePdfFile(file, { title: text, text });

      if (outcome === "downloaded") {
        // A new tab, so the report stays open for the operator to come back to.
        window.open(whatsappLink(text), "_blank", "noopener");
        setStatus({
          tone: "ok",
          text: "PDF downloaded. Attach it in the WhatsApp chat that just opened.",
        });
      }
    } catch (caught) {
      // Closing the share sheet is a choice, not a failure.
      if (isAbortError(caught)) return;
      setStatus({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Could not share the report.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={print}
        onPointerEnter={loader.prefetch}
        onFocus={loader.prefetch}
        disabled={busy !== null}
      >
        <Printer className="size-4" aria-hidden />
        {busy === "print" ? "Preparing…" : "Print"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={share}
        onPointerEnter={loader.prefetch}
        onFocus={loader.prefetch}
        disabled={busy !== null}
      >
        <MessageCircle className="size-4" aria-hidden />
        {busy === "share" ? "Preparing…" : "Share on WhatsApp"}
      </Button>
      <ButtonLink href={`${url}&download`} variant="ghost" size="sm">
        <Download className="size-4" aria-hidden />
        Download PDF
      </ButtonLink>

      {status && (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={`w-full text-xs ${
            status.tone === "error" ? "text-amber-700" : "text-emerald-700"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
