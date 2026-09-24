"use client";

import { useState } from "react";
import { Download, MessageCircle, Printer } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Print or share one product's stock sheet.
 *
 * Both use the same server-rendered PDF, so what is printed and what is sent
 * on WhatsApp are the same document.
 *
 * WhatsApp: the phone's share sheet (Web Share API) sends the PDF itself as a
 * document. Where a browser cannot share files — most desktops — the PDF is
 * downloaded and WhatsApp opens, ready for it to be attached. A web link can
 * open a chat, but it can never attach a file by itself.
 */
export function StockSheetActions({
  productId,
  productName,
  fileName,
}: {
  productId: string;
  productName: string;
  fileName: string;
}) {
  const url = `/shop/stock/${productId}/pdf`;
  const [busy, setBusy] = useState<"print" | "share" | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string }>();

  async function loadPdf(): Promise<Blob> {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Stock sheet failed (${response.status})`);
    return response.blob();
  }

  async function print() {
    setBusy("print");
    setNote(undefined);
    try {
      const blobUrl = URL.createObjectURL(await loadPdf());
      // A hidden frame keeps the operator on this page; the browser's PDF
      // viewer inside it owns the print dialog.
      document.getElementById("stock-sheet-print")?.remove();
      const frame = document.createElement("iframe");
      frame.id = "stock-sheet-print";
      frame.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      frame.src = blobUrl;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          // Some mobile browsers refuse to print a framed PDF.
          window.open(blobUrl, "_blank", "noopener");
        }
      };
      document.body.appendChild(frame);
    } catch {
      setNote({ tone: "error", text: "Could not prepare the sheet to print." });
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setNote(undefined);
    const text = `OptiSource PK — stock sheet: ${productName}`;
    try {
      const blob = await loadPdf();
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: text, text });
        return;
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener",
      );
      setNote({
        tone: "ok",
        text: "PDF downloaded. Attach it in the WhatsApp chat that just opened.",
      });
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNote({ tone: "error", text: "Could not share the sheet." });
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
        disabled={busy !== null}
      >
        <MessageCircle className="size-4" aria-hidden />
        {busy === "share" ? "Preparing…" : "Share on WhatsApp"}
      </Button>
      <ButtonLink href={`${url}?download`} variant="ghost" size="sm">
        <Download className="size-4" aria-hidden />
        Download PDF
      </ButtonLink>

      {note && (
        <p
          role={note.tone === "error" ? "alert" : "status"}
          className={`w-full text-xs ${
            note.tone === "error" ? "text-amber-700" : "text-emerald-700"
          }`}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
