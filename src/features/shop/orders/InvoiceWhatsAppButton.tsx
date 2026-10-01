import { MessageCircle } from "lucide-react";
import type { Order } from "@/types/database";
import { formatAmount } from "@/lib/format";
import { whatsappLink } from "@/features/shop/rx/whatsapp";

/** Open WhatsApp with the issued invoice summary ready to send. */
export function InvoiceWhatsAppButton({ order }: { order: Order }) {
  if (order.invoice_no === null || order.voided_at !== null) return null;

  const billTo = order.bill_to_shop ?? order.bill_to_name ?? "Customer";
  const message = [
    `Assalam-o-Alaikum, ${billTo}.`,
    `Invoice *${order.invoice_no}* has been issued.`,
    order.combines_rx && order.notes ? order.notes : null,
    `Amount: Rs ${formatAmount(order.amount_incl_tax ?? 0)}.`,
    order.closing_balance === null
      ? null
      : `Total account balance: Rs ${formatAmount(order.closing_balance)}.`,
    "Thank you.",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
    >
      <MessageCircle className="size-4" aria-hidden />
      Share on WhatsApp
    </a>
  );
}
