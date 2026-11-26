import { formatAmount, formatDate } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/validations/shop/payment";
import type { PurchaseInvoiceBalance, SupplierPayment } from "@/types/database";

/**
 * What is owed on each purchase invoice, and the payments sent to the supplier.
 * Rendered on the server; the form that records a payment sits beside it.
 */
export function SupplierPayments({
  invoices,
  payments,
}: {
  invoices: PurchaseInvoiceBalance[];
  payments: SupplierPayment[];
}) {
  const invoiceNoById = new Map(
    invoices.map((invoice) => [invoice.id, invoice.invoice_no]),
  );
  const methodLabel = new Map(PAYMENT_METHODS.map((m) => [m.value, m.label]));

  if (invoices.length === 0) {
    return (
      <p className="text-navy-500 text-sm">
        Record a purchase first. Payments are made against purchase invoices.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="shadow-lift overflow-x-auto rounded-2xl bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Amount owed per purchase invoice
          </caption>
          <thead>
            <tr className="text-navy-500 bg-mist-100 text-left">
              <th scope="col" className="px-4 py-3 font-medium">
                Invoice
              </th>
              <th
                scope="col"
                className="hidden px-4 py-3 font-medium sm:table-cell"
              >
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Total (Rs)
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Paid (Rs)
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Owed (Rs)
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-mist-200">
                <td className="px-4 py-3 font-medium">{invoice.invoice_no}</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  {formatDate(invoice.invoice_date)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatAmount(invoice.total_amount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatAmount(invoice.paid_amount)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold tabular-nums ${
                    invoice.balance > 0 ? "text-amber-700" : "text-navy-500"
                  }`}
                >
                  {formatAmount(invoice.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold">Payments sent</h3>
        {payments.length === 0 ? (
          <p className="text-navy-500 text-sm">No payments sent yet.</p>
        ) : (
          <div className="shadow-lift overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Payments sent to this supplier
              </caption>
              <thead>
                <tr className="text-navy-500 bg-mist-100 text-left">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Invoice
                  </th>
                  <th
                    scope="col"
                    className="hidden px-4 py-3 font-medium sm:table-cell"
                  >
                    Paid by
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Amount (Rs)
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-mist-200">
                    <td className="px-4 py-3">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-4 py-3">
                      {invoiceNoById.get(payment.purchase_invoice_id) ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {methodLabel.get(payment.payment_method) ??
                        payment.payment_method}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatAmount(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
