"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import type { Order, OrderLine } from "@/types/database";
import { formatRxNo } from "@/lib/format";
import {
  patientLabMessage,
  shopMessage,
  whatsappLink,
  type RxMessageOrder,
} from "./whatsapp";

/**
 * Share an RX job on WhatsApp: the order for the lab (no prices), then
 * "ready" for the shop once it is back. Each opens WhatsApp with the message
 * typed; the operator chooses who to send it to.
 *
 * A Client Component only for the "include optician" tick: the optician is
 * always on the order, but whether the lab sees it is the operator's call.
 */
export function RxWhatsAppButtons({
  order,
  jobs,
  shopName,
}: {
  order: Order;
  /** This order and the patient's other RX orders booked the same day. */
  jobs: { order: Order; lines: OrderLine[] }[];
  shopName: string;
}) {
  const [includeOptician, setIncludeOptician] = useState(false);

  if (order.voided_at) return null;

  const toMessage = (o: Order): RxMessageOrder => ({
    rxNo: o.rx_no,
    patientName: o.patient_name,
    lensType: o.rx_lens_type,
    frameMaterial: o.frame_material,
    frameType: o.frame_type,
    shopName,
    invoiceNo: o.invoice_no,
    amount: o.amount_incl_tax,
  });
  const message = toMessage(order);
  const labJobs = jobs.map((job) => ({
    order: toMessage(job.order),
    lines: job.lines,
  }));
  const others = jobs.filter((job) => job.order.id !== order.id);
  const back = order.rx_stage === "back";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-mist-200 pt-4">
      <WhatsAppLink
        href={whatsappLink(patientLabMessage(labJobs, { includeOptician }))}
        label={
          labJobs.length > 1
            ? `Send ${labJobs.length} orders on WhatsApp`
            : "Send order on WhatsApp"
        }
        primary={!back}
      />
      <label className="text-navy-600 inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeOptician}
          onChange={(e) => setIncludeOptician(e.target.checked)}
          className="size-4"
        />
        Include optician name ({shopName})
      </label>
      {back && (
        <WhatsAppLink
          href={whatsappLink(shopMessage(message))}
          label="Send ready message on WhatsApp"
          primary
        />
      )}
      <p className="text-navy-400 w-full text-xs">
        {others.length > 0 && (
          <>
            Includes {order.patient_name}&rsquo;s other RX{" "}
            {others.length === 1 ? "order" : "orders"} from the same day:{" "}
            {others.map((job, i) => (
              <span key={job.order.id}>
                {i > 0 && ", "}
                <Link
                  href={`/shop/orders/${job.order.id}`}
                  className="text-accent-700 underline underline-offset-2"
                >
                  {formatRxNo(job.order.rx_no)}
                </Link>
              </span>
            ))}
            .{" "}
          </>
        )}
        Opens WhatsApp with the message ready. You choose who to send it to.
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
