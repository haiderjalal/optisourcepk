"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { formatAmount } from "@/lib/format";
import { whatsappLink } from "@/features/shop/rx/whatsapp";
import {
  createPdfLoader,
  isAbortError,
  sharePdfFile,
} from "@/features/shop/pdf/sharePdf";

interface InvoiceWhatsAppButtonProps {
  orderId: string;
  invoiceNo: number;
  billTo: string;
  amount: number;
  closingBalance: number | null;
  rxNotes: string | null;
  /** false: share this invoice only, without the account balance. */
  includeBalance?: boolean;
}

/**
 * Share the rendered invoice PDF. The PDF starts loading on hover or focus, so
 * the share sheet can open straight from the click. Where the browser cannot
 * attach a file, the PDF is downloaded and WhatsApp opens for it to be attached.
 */
export function InvoiceWhatsAppButton({
  orderId,
  invoiceNo,
  billTo,
  amount,
  closingBalance,
  rxNotes,
  includeBalance = true,
}: InvoiceWhatsAppButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pdfUrl = `/shop/invoices/${orderId}/pdf${includeBalance ? "" : "?balance=0"}`;
  const fileName = `OptiSource-Invoice-${invoiceNo}.pdf`;
  const loader = useMemo(
    () => createPdfLoader(pdfUrl, fileName),
    [pdfUrl, fileName],
  );

  function buildMessage(): string {
    return [
      `Assalam-o-Alaikum, ${billTo}.`,
      `Invoice *${invoiceNo}* has been issued.`,
      rxNotes,
      `Amount: Rs ${formatAmount(amount)}.`,
      closingBalance === null || !includeBalance
        ? null
        : `Total account balance: Rs ${formatAmount(closingBalance)}.`,
      "Thank you.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function sharePdf() {
    setBusy(true);
    setError(undefined);

    const message = buildMessage();
    try {
      const file = await loader.load();
      const outcome = await sharePdfFile(file, {
        title: `Invoice ${invoiceNo}`,
        text: message,
      });

      // WhatsApp Web cannot be given an attachment by a website, so after the
      // download the chat opens in this tab for the PDF to be attached.
      if (outcome === "downloaded")
        window.location.assign(whatsappLink(message));
    } catch (caught) {
      if (isAbortError(caught)) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not prepare the invoice PDF for sharing.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={sharePdf}
        onPointerEnter={loader.prefetch}
        onFocus={loader.prefetch}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        <MessageCircle className="size-4" aria-hidden />
        {busy ? "Preparing PDF…" : "Share PDF on WhatsApp"}
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-64 text-xs text-amber-700">
          {error}
        </p>
      )}
    </div>
  );
}
