import { formatAmount, formatDate } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/validations/shop/payment";
import type { SupplierBalance, SupplierPayment } from "@/types/database";

/**
 * The supplier's account as one bill: everything bought, everything paid, and
 * what is still owed, then the payments sent. Rendered on the server; the form
 * that records a payment sits beside it.
 */
export function SupplierPayments({
  balance,
  payments,
}: {
  balance: SupplierBalance | null;
  payments: SupplierPayment[];
}) {
  const methodLabel = new Map(PAYMENT_METHODS.map((m) => [m.value, m.label]));
  const bought = balance?.total_bought ?? 0;
  const paid = balance?.total_paid ?? 0;
  const owed = balance?.owed ?? 0;

  if (bought === 0 && payments.length === 0) {
    return (
      <p className="text-navy-500 text-sm">
        Record a purchase first. Payments are made against what was bought.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <dl className="shadow-lift grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-3">
        <div>
          <dt className="text-navy-500 text-xs">Total bought</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            Rs {formatAmount(bought)}
          </dd>
        </div>
        <div>
          <dt className="text-navy-500 text-xs">Paid</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            Rs {formatAmount(paid)}
          </dd>
        </div>
        <div>
          <dt className="text-navy-500 text-xs">Owed</dt>
          <dd
            className={`mt-1 text-lg font-semibold tabular-nums ${
              owed > 0 ? "text-amber-700" : "text-navy-500"
            }`}
          >
            Rs {formatAmount(owed)}
          </dd>
        </div>
      </dl>

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
                    Paid by
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Reference
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Note
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Amount (Rs)
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-mist-200">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-4 py-3">
                      {methodLabel.get(payment.payment_method) ??
                        payment.payment_method}
                    </td>
                    <td className="px-4 py-3">{payment.reference ?? "—"}</td>
                    <td className="px-4 py-3">{payment.memo ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
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
