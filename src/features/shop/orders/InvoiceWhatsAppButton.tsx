"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { formatAmount } from "@/lib/format";
import { whatsappLink } from "@/features/shop/rx/whatsapp";

interface InvoiceWhatsAppButtonProps {
  orderId: string;
  invoiceNo: number;
  billTo: string;
  amount: number;
  closingBalance: number | null;
  rxNotes: string | null;
}

/** Share the rendered invoice PDF, with a download fallback for desktop. */
export function InvoiceWhatsAppButton({
  orderId,
  invoiceNo,
  billTo,
  amount,
  closingBalance,
  rxNotes,
}: InvoiceWhatsAppButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function sharePdf() {
    setBusy(true);
    setError(undefined);

    const message = [
      `Assalam-o-Alaikum, ${billTo}.`,
      `Invoice *${invoiceNo}* has been issued.`,
      rxNotes,
      `Amount: Rs ${formatAmount(amount)}.`,
      closingBalance === null
        ? null
        : `Total account balance: Rs ${formatAmount(closingBalance)}.`,
      "Thank you.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch(`/shop/invoices/${orderId}/pdf`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`PDF failed (${response.status})`);

      const file = new File(
        [await response.blob()],
        `OptiSource-Invoice-${invoiceNo}.pdf`,
        { type: "application/pdf" },
      );

      // Mobile browsers that support file sharing attach the PDF directly to
      // the chosen app (including WhatsApp).
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoiceNo}`,
          text: message,
        });
        return;
      }

      // WhatsApp Web cannot be given an attachment by a website. Download the
      // exact PDF, then continue to WhatsApp in this same tab for attachment.
      const download = document.createElement("a");
      download.href = URL.createObjectURL(file);
      download.download = file.name;
      download.click();
      window.location.assign(whatsappLink(message));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        return;
      }
      setError("Could not prepare the invoice PDF for sharing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={sharePdf}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        <MessageCircle className="size-4" aria-hidden />
        {busy ? "Preparing PDF…" : "Share PDF on WhatsApp"}
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-52 text-xs text-amber-700">
          {error}
        </p>
      )}
    </div>
  );
}
