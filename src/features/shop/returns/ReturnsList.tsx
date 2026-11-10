import Link from "next/link";
import { FileText } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { describeBin, formatAmount, formatDateTime } from "@/lib/format";
import type { ReturnWithDetail } from "@/services/shop/return.service";
import { deleteReturnAction } from "./actions";
import { returnLabel } from "./label";

/**
 * Returns with their items, newest first. Server-rendered; the only action is
 * Undo, which confirms in place.
 */
export function ReturnsList({
  returns,
  showInvoice = true,
}: {
  returns: ReturnWithDetail[];
  /** False on an invoice's own page, where the invoice is already known. */
  showInvoice?: boolean;
}) {
  return (
    <ul className="divide-y divide-mist-200">
      {returns.map((ret) => (
        <li key={ret.id} className="px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <p className="font-semibold">
                {returnLabel(ret.return_no)}
                <span className="text-navy-500 ml-2 text-sm font-normal">
                  {formatDateTime(ret.returned_at)}
                </span>
              </p>
              {showInvoice && (
                <p className="text-navy-600 text-sm">
                  {ret.shopName} ·{" "}
                  <Link
                    href={`/shop/orders/${ret.order_id}`}
                    className="text-accent-600 hover:text-accent-700 font-medium"
                  >
                    Invoice {ret.invoiceNo ?? "—"}
                  </Link>
                </p>
              )}
              {ret.note && (
                <p className="text-navy-500 mt-0.5 text-xs">{ret.note}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">
                Rs {formatAmount(ret.amount)}
              </span>
              <Link
                href={`/shop/returns/${ret.id}/pdf`}
                className="text-accent-600 hover:text-accent-700 inline-flex items-center gap-1 text-xs font-medium"
              >
                <FileText className="size-3.5" aria-hidden />
                PDF
              </Link>
              <ConfirmButton
                action={deleteReturnAction}
                id={ret.id}
                name={returnLabel(ret.return_no)}
                kind="delete"
                question="Undo this return?"
                confirmLabel="Undo"
              />
            </div>
          </div>

          <ul className="text-navy-600 mt-2 space-y-0.5 text-sm">
            {ret.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {line.quantity} × {line.product_name}
                  {describeBin(line) && (
                    <span className="text-navy-500 ml-1.5 font-mono text-xs">
                      {describeBin(line)}
                    </span>
                  )}
                  {line.stock_source === "daily" && (
                    <span className="text-navy-400 ml-1.5 text-xs">daily</span>
                  )}
                </span>
                <span className="tabular-nums">
                  {formatAmount(line.amount)}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
