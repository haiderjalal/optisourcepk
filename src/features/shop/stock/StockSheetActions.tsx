"use client";

import { useMemo, useState } from "react";
import { Download, MessageCircle, Printer } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  createPdfLoader,
  isAbortError,
  sharePdfFile,
} from "@/features/shop/pdf/sharePdf";
import type { SheetLayout } from "./orientation";

/**
 * Print or share one product's stock sheet.
 *
 * Both use the same server-rendered PDF, so what is printed and what is sent
 * on WhatsApp are the same document. The PDF starts loading on hover or focus,
 * so the share sheet can open straight from the click.
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
  layout,
}: {
  productId: string;
  productName: string;
  fileName: string;
  layout: SheetLayout;
}) {
  const url = `/shop/stock/${productId}/pdf?layout=${layout}`;
  const loader = useMemo(() => createPdfLoader(url, fileName), [url, fileName]);
  const [busy, setBusy] = useState<"print" | "share" | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string }>();

  async function print() {
    setBusy("print");
    setNote(undefined);
    try {
      const blobUrl = URL.createObjectURL(await loader.load());
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
          window.location.assign(blobUrl);
        }
      };
      document.body.appendChild(frame);
    } catch (caught) {
      setNote({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Could not prepare the sheet to print.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setNote(undefined);
    const text = `OptiSource PK — stock sheet: ${productName}`;
    try {
      const file = await loader.load();
      const outcome = await sharePdfFile(file, { title: text, text });

      if (outcome === "downloaded") {
        window.location.assign(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
        );
        setNote({
          tone: "ok",
          text: "PDF downloaded. Attach it in the WhatsApp chat that just opened.",
        });
      }
    } catch (caught) {
      // Closing the share sheet is a choice, not a failure.
      if (isAbortError(caught)) return;
      setNote({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Could not share the sheet.",
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
