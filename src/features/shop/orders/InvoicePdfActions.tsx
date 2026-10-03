"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { InvoiceWhatsAppButton } from "./InvoiceWhatsAppButton";

/**
 * View, download and share an issued invoice — with or without the previous
 * balance. Some shops get the full account on every invoice, others only the
 * invoice itself; the choice is remembered per customer on this device.
 */

const storageKey = (customerId: string) => `invoice-balance:${customerId}`;

export function InvoicePdfActions({
  orderId,
  customerId,
  invoiceNo,
  billTo,
  amount,
  closingBalance,
  rxNotes,
  canShare,
  hasBalance,
}: {
  orderId: string;
  customerId: string;
  invoiceNo: number | null;
  billTo: string;
  amount: number;
  closingBalance: number | null;
  rxNotes: string | null;
  /** Not voided, and numbered. */
  canShare: boolean;
  /** The invoice has a balance snapshot to show at all. */
  hasBalance: boolean;
}) {
  const [includeBalance, setIncludeBalance] = useState(true);

  // Storage is only readable in the browser, so the remembered choice is
  // applied after the first render. ponytail: per device; move to a customer
  // column if it must follow the shop across computers.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey(customerId));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from storage once on mount
      if (saved === "0") setIncludeBalance(false);
    } catch {
      // Storage blocked: keep the default, the balance included.
    }
  }, [customerId]);

  function choose(include: boolean) {
    setIncludeBalance(include);
    try {
      window.localStorage.setItem(storageKey(customerId), include ? "1" : "0");
    } catch {
      // Not remembered this time; the choice still applies now.
    }
  }

  const show = hasBalance && includeBalance;
  const pdf = `/shop/invoices/${orderId}/pdf`;
  const query = (download: boolean) => {
    const params = [download ? "download" : null, show ? null : "balance=0"]
      .filter(Boolean)
      .join("&");
    return params ? `${pdf}?${params}` : pdf;
  };

  return (
    <>
      {hasBalance && (
        <label className="text-navy-600 inline-flex items-center gap-2 self-center rounded-lg border border-mist-300 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={includeBalance}
            onChange={(e) => choose(e.target.checked)}
            className="size-4"
          />
          Include previous balance
        </label>
      )}
      <ButtonLink href={query(false)} variant="outline">
        <FileText className="size-4" aria-hidden />
        View PDF
      </ButtonLink>
      <ButtonLink href={query(true)}>
        <Download className="size-4" aria-hidden />
        Download
      </ButtonLink>
      {canShare && invoiceNo !== null && (
        <InvoiceWhatsAppButton
          orderId={orderId}
          invoiceNo={invoiceNo}
          billTo={billTo}
          amount={amount}
          closingBalance={closingBalance}
          rxNotes={rxNotes}
          includeBalance={show}
        />
      )}
    </>
  );
}
