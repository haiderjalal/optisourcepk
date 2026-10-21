import "server-only";

import { requireUser } from "@/server/shop/dal";
import type { RxStatus } from "@/types/database";
import {
  karachiDate,
  karachiRangeBounds,
  rxLabRow,
  type RxLabOrder,
  type RxLabRow,
} from "@/features/shop/rx/labReport";
import { describePostgresError } from "./errors";
import { embeddedPage, selectAllPages } from "./paging";

interface ReportLineRow {
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  unit_cost: number | string | null;
  rx_status: RxStatus | null;
  suppliers: { name: string } | null;
}

interface ReportOrderRow {
  id: string;
  rx_no: number | null;
  lab_order_no: string | null;
  created_at: string;
  patient_name: string | null;
  voided_at: string | null;
  customers: { shop_name: string } | null;
  order_lines: ReportLineRow[];
}

function toRxLabOrder(row: ReportOrderRow): RxLabOrder {
  return {
    id: row.id,
    rxNo: row.rx_no,
    labOrderNo: row.lab_order_no,
    date: karachiDate(row.created_at),
    patientName: row.patient_name,
    shopName: row.customers?.shop_name ?? "—",
    voided: row.voided_at !== null,
    // The order's own RX lines only: a combined invoice's copies belong to that invoice.
    lenses: row.order_lines
      .filter((line) => line.rx_status !== null)
      .map((line) => ({
        quantity: line.quantity,
        unitPrice: Number(line.unit_price),
        lineTotal: Number(line.line_total),
        unitCost: line.unit_cost === null ? null : Number(line.unit_cost),
        supplierName: line.suppliers?.name ?? null,
      })),
  };
}

/** RX orders created within the Karachi date range (inclusive), in RX number order. */
export async function listRxLabRows(range: {
  from: string;
  to: string;
}): Promise<RxLabRow[]> {
  const { supabase } = await requireUser();
  const bounds = karachiRangeBounds(range);

  const rows = await selectAllPages<ReportOrderRow>((from, to) =>
    embeddedPage<ReportOrderRow>(
      supabase
        .from("orders")
        .select(
          "id, rx_no, lab_order_no, created_at, patient_name, voided_at, customers(shop_name), order_lines(quantity, unit_price, line_total, unit_cost, rx_status, suppliers(name))",
        )
        .eq("is_rx", true)
        .gte("created_at", bounds.start)
        .lt("created_at", bounds.end)
        .order("rx_no")
        .order("id")
        .range(from, to),
    ),
  ).catch((error: unknown) => {
    throw new Error(describePostgresError(error, "load the RX lab report"));
  });

  return rows.map((row) => rxLabRow(toRxLabOrder(row)));
}
