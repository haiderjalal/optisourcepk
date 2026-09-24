import type { StockSheet } from "@/services/shop/stock.service";
import {
  orientSheet,
  type SheetLayout,
} from "@/features/shop/stock/orientation";

/**
 * One lens product's stock, laid out like the printed "Lens Stock Detail
 * List": SPH down the side and CYL across the top (or swapped), with a
 * total under each column.
 *
 * A red border marks a power with nothing on hand; amber marks one at or
 * below the alert quantity. The number is always printed as well, so colour
 * is never the only signal.
 *
 * Stateless: the panel around it owns which way round it is drawn.
 */

export function StockSheetTable({
  sheet,
  layout,
}: {
  sheet: StockSheet;
  layout: SheetLayout;
}) {
  const view = orientSheet(sheet, layout);

  const columnTotal = (across: number | null) =>
    view.down.reduce<number>(
      (sum, down) => sum + (view.cell(down, across)?.qty ?? 0),
      0,
    );

  return (
    <div className="overflow-x-auto">
      <table className="border-navy-300 border-collapse border text-sm">
        <caption className="sr-only">Quantity on hand, {view.corner}</caption>
        <thead>
          <tr className="text-navy-600 bg-mist-100 text-xs">
            <th
              scope="col"
              className="border-navy-300 sticky left-0 z-10 border bg-mist-100 px-3 py-2 text-center font-semibold whitespace-nowrap"
            >
              {view.corner}
            </th>
            {view.across.map((across) => (
              <th
                key={across ?? "none"}
                scope="col"
                className="border-navy-300 min-w-14 border px-2 py-2 text-center font-mono font-semibold"
              >
                {view.acrossLabel(across)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.down.map((down) => (
            <tr key={down ?? "none"}>
              <th
                scope="row"
                className="border-navy-300 sticky left-0 z-10 border bg-white px-3 py-1 text-center font-mono text-xs font-semibold whitespace-nowrap"
              >
                {view.downLabel(down)}
              </th>
              {view.across.map((across) => {
                const cell = view.cell(down, across);
                const qty = cell?.qty ?? 0;
                return (
                  <td
                    key={across ?? "none"}
                    className="border-navy-300 border p-0.5 text-center"
                  >
                    <span
                      className={`block rounded px-1.5 py-0.5 tabular-nums ${
                        qty === 0
                          ? "text-red-700 ring-2 ring-red-500 ring-inset"
                          : cell?.low
                            ? "bg-amber-50 font-semibold text-amber-800 ring-1 ring-amber-300 ring-inset"
                            : "font-semibold"
                      }`}
                    >
                      {qty}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-mist-50">
            <th
              scope="row"
              className="border-navy-300 sticky left-0 z-10 border bg-mist-50 px-3 py-2 text-center text-xs font-semibold"
            >
              Total
            </th>
            {view.across.map((across) => (
              <td
                key={across ?? "none"}
                className="border-navy-300 border px-2 py-2 text-center font-semibold tabular-nums"
              >
                {columnTotal(across)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
