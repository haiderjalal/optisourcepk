import { formatPower } from "@/lib/format";
import type { StockSheet } from "@/services/shop/stock.service";

/**
 * One lens product's stock, laid out like the printed "Lens Stock Detail
 * List": SPH down the side, CYL across the top, a total under each column.
 *
 * A red border marks a power with nothing on hand; amber marks one at or
 * below the alert quantity. The number is always printed as well, so colour
 * is never the only signal.
 *
 * Server-rendered: it has no state, and a sheet can run to hundreds of cells.
 */

const key = (sph: number, cyl: number | null) => `${sph}|${cyl ?? ""}`;

export function StockSheetTable({ sheet }: { sheet: StockSheet }) {
  const { sphs, cyls, cells } = sheet;
  const byCyl = cyls[0] !== null || cyls.length > 1;

  const columnTotal = (cyl: number | null) =>
    sphs.reduce((sum, sph) => sum + (cells[key(sph, cyl)]?.qty ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-mist-200">
      <table className="text-sm">
        <caption className="sr-only">
          Quantity on hand by SPH{byCyl && " and CYL"}
        </caption>
        <thead>
          <tr className="text-navy-600 bg-mist-100 text-xs">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-mist-100 px-3 py-2 text-left font-semibold whitespace-nowrap"
            >
              {byCyl ? "SPH | CYL" : "SPH"}
            </th>
            {cyls.map((cyl) => (
              <th
                key={cyl ?? "none"}
                scope="col"
                className="min-w-14 px-2 py-2 text-center font-mono font-semibold"
              >
                {byCyl ? formatPower(cyl ?? 0) : "Qty"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sphs.map((sph) => (
            <tr key={sph} className="border-t border-mist-200">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white px-3 py-1 text-left font-mono text-xs font-semibold whitespace-nowrap"
              >
                {formatPower(sph)}
              </th>
              {cyls.map((cyl) => {
                const cell = cells[key(sph, cyl)];
                const qty = cell?.qty ?? 0;
                return (
                  <td key={cyl ?? "none"} className="px-1 py-1 text-center">
                    <span
                      className={`block rounded px-1.5 py-0.5 tabular-nums ${
                        qty === 0
                          ? "text-red-700 ring-1 ring-red-400 ring-inset"
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
          <tr className="border-t-2 border-mist-300 bg-mist-50">
            <th
              scope="row"
              className="sticky left-0 z-10 bg-mist-50 px-3 py-2 text-left text-xs font-semibold"
            >
              Total
            </th>
            {cyls.map((cyl) => (
              <td
                key={cyl ?? "none"}
                className="px-2 py-2 text-center font-semibold tabular-nums"
              >
                {columnTotal(cyl)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
