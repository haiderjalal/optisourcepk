import type { Order } from "@/types/database";

/**
 * Where an order stands, in one glance.
 *
 * Derived rather than read straight off `status`, because "issued" is not a
 * status value — it is whether an invoice number has been assigned — and void
 * has to win over everything else.
 */
export function StatusBadge({ order }: { order: Order }) {
  const { label, tone } = describe(order);

  const tones = {
    draft: "bg-mist-200 text-navy-600",
    issued:
      "bg-accent-600/10 text-accent-700 ring-1 ring-accent-600/20 ring-inset",
    dispatched: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 ring-inset",
    delivered:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset",
    void: "bg-amber-50 text-amber-800 ring-1 ring-amber-200 ring-inset",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

function describe(order: Order): {
  label: string;
  tone: "draft" | "issued" | "dispatched" | "delivered" | "void";
} {
  if (order.voided_at) return { label: "Void", tone: "void" };
  if (order.status === "delivered")
    return { label: "Delivered", tone: "delivered" };
  if (order.status === "dispatched")
    return { label: "Dispatched", tone: "dispatched" };
  if (order.issued_at) return { label: "Invoiced", tone: "issued" };
  return { label: "Draft", tone: "draft" };
}
