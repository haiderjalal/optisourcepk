import { MessageCircle } from "lucide-react";
import type { Order, OrderLine, Supplier } from "@/types/database";
import {
  labMessage,
  shopMessage,
  whatsappLink,
  whatsappNumber,
  type RxMessageOrder,
} from "./whatsapp";

/**
 * Send an RX job on WhatsApp: the order to the lab (no prices), then "ready"
 * to the shop once it is back. Each opens WhatsApp with the message typed;
 * the operator checks it and presses send.
 */
export function RxWhatsAppButtons({
  order,
  lines,
  shopName,
  shopPhone,
  lab,
}: {
  order: Order;
  lines: OrderLine[];
  shopName: string;
  shopPhone: string | null;
  lab: Supplier | null;
}) {
  const message: RxMessageOrder = {
    rxNo: order.rx_no,
    patientName: order.patient_name,
    lensType: order.rx_lens_type,
    tintReason: order.rx_tint_reason,
    frameMaterial: order.frame_material,
    frameType: order.frame_type,
    shopName,
    invoiceNo: order.invoice_no,
    amount: order.amount_incl_tax,
  };
  const back = order.rx_stage === "back";
  const labHasPhone = whatsappNumber(lab?.phone ?? null) !== null;
  const shopHasPhone = whatsappNumber(shopPhone) !== null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-mist-200 pt-4">
      {!order.voided_at && (
        <WhatsAppLink
          href={whatsappLink(lab?.phone ?? null, labMessage(message, lines))}
          label={
            lab ? `Send to ${lab.name} on WhatsApp` : "Send to lab on WhatsApp"
          }
          primary={!back}
        />
      )}
      {back && !order.voided_at && (
        <WhatsAppLink
          href={whatsappLink(shopPhone, shopMessage(message))}
          label={`Send to ${shopName} on WhatsApp`}
          primary
        />
      )}
      <p className="text-navy-400 w-full text-xs">
        {!lab
          ? "No lab chosen — pick one with Edit so the message goes to their number."
          : !labHasPhone
            ? `${lab.name} has no WhatsApp number — add it in Suppliers, or pick the chat yourself.`
            : back && !shopHasPhone
              ? `${shopName} has no phone number saved — pick the chat yourself.`
              : "Opens WhatsApp with the message ready to check and send."}
      </p>
    </div>
  );
}

function WhatsAppLink({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
        primary
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "text-navy-700 border border-mist-300 bg-white hover:bg-mist-100"
      }`}
    >
      <MessageCircle className="size-4" aria-hidden />
      {label}
    </a>
  );
}
