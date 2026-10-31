"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pdfFileName } from "@/features/shop/pdf/pdfResponse";
import {
  createPdfLoader,
  isAbortError,
  sharePdfFile,
} from "@/features/shop/pdf/sharePdf";
import { whatsappLink } from "@/features/shop/rx/whatsapp";
import { statementShareMessage } from "./statementMessage";

interface CustomerStatementShareProps {
  customerId: string;
  shopName: string;
  /** The shop's number in WhatsApp's form, or null when its phone has none. */
  number: string | null;
  balance: number;
}

/**
 * Share a shop's ledger statement on WhatsApp from the shops list.
 *
 * On a phone the share sheet sends the PDF itself and the operator picks the
 * chat there. Where the browser cannot share files, the PDF is downloaded and
 * the shop's own chat opens in a new tab, with the message typed, for the PDF
 * to be attached — a website cannot attach a file to a chat for you.
 */
export function CustomerStatementShare({
  customerId,
  shopName,
  number,
  balance,
}: CustomerStatementShareProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pdfUrl = `/shop/customers/${customerId}/statement/pdf`;
  const fileName = pdfFileName("Ledger", shopName);
  // The PDF is fetched once per mount. The shops list keys this by the balance,
  // so a new balance remounts it and the old statement is never reused.
  const loader = useMemo(
    () => createPdfLoader(pdfUrl, fileName),
    [pdfUrl, fileName],
  );

  async function share() {
    if (number === null) return;
    setBusy(true);
    setError(undefined);

    const message = statementShareMessage({ shopName, balance });
    try {
      const file = await loader.load();
      const outcome = await sharePdfFile(file, {
        title: `Statement for ${shopName}`,
        text: message,
      });

      if (outcome === "downloaded") {
        // A new tab, so the shops list stays open to come back to.
        window.open(whatsappLink(message, number), "_blank", "noopener");
      }
    } catch (caught) {
      // Closing the share sheet is a choice, not a failure.
      if (isAbortError(caught)) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not prepare the statement for WhatsApp.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (number === null) {
    return (
      <span title="This shop's phone has no number WhatsApp can use">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          aria-label={`${shopName} has no phone number WhatsApp can use`}
        >
          <MessageCircle className="size-3.5" aria-hidden />
          WhatsApp
        </Button>
      </span>
    );
  }

  // Like the confirm buttons, the message replaces the control rather than
  // pushing the row's layout around.
  if (error) {
    return (
      <div className="flex items-center gap-1.5">
        <p role="alert" className="max-w-56 text-right text-xs text-amber-700">
          {error}
        </p>
        <button
          type="button"
          onClick={() => setError(undefined)}
          className="text-navy-500 hover:text-navy-700 rounded-md px-2 py-1 text-xs font-medium"
        >
          OK
        </button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={share}
      onPointerEnter={loader.prefetch}
      onFocus={loader.prefetch}
      disabled={busy}
      aria-label={`Share ${shopName} statement on WhatsApp`}
    >
      <MessageCircle className="size-3.5 text-emerald-600" aria-hidden />
      {busy ? "Preparing…" : "WhatsApp"}
    </Button>
  );
}
