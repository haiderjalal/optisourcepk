/**
 * Pair the R and L lenses of one job into one row. Pure, so the RX screen
 * and its check run the same grouping.
 *
 * A job is one product on one order under one reference. Within it, each R is
 * paired with the next unpaired L in line order (and vice versa); a lens with
 * no partner, or no eye, stands alone.
 */

export interface PairableLine {
  id: string;
  order_id: string;
  product_id: string;
  order_ref: string | null;
  line_no: number;
  eye: string | null;
}

/**
 * Rows of one or two lines, in the order of `lines`. Only rows holding at
 * least one of `matched` are kept, so a search that hits one eye still shows
 * its partner.
 */
export function pairEyes<T extends PairableLine>(
  lines: T[],
  matched: ReadonlySet<string>,
): T[][] {
  const jobs = new Map<string, T[]>();
  for (const line of lines) {
    const key = [line.order_id, line.product_id, line.order_ref ?? ""].join(
      "|",
    );
    const job = jobs.get(key) ?? [];
    job.push(line);
    jobs.set(key, job);
  }

  const rowOf = new Map<string, T[]>();
  for (const job of jobs.values()) {
    const byLine = [...job].sort((a, b) => a.line_no - b.line_no);
    const open: T[] = [];

    for (const line of byLine) {
      const partnerAt =
        line.eye === "R" || line.eye === "L"
          ? open.findIndex((o) => o.eye !== null && o.eye !== line.eye)
          : -1;

      if (partnerAt >= 0) {
        const [partner] = open.splice(partnerAt, 1);
        // R first, as a prescription is written.
        const row = partner.eye === "R" ? [partner, line] : [line, partner];
        rowOf.set(partner.id, row);
        rowOf.set(line.id, row);
      } else if (line.eye === "R" || line.eye === "L") {
        open.push(line);
      } else {
        rowOf.set(line.id, [line]);
      }
    }
    for (const line of open) rowOf.set(line.id, [line]);
  }

  const out: T[][] = [];
  const seen = new Set<T[]>();
  for (const line of lines) {
    const row = rowOf.get(line.id);
    if (!row || seen.has(row)) continue;
    seen.add(row);
    if (row.some((l) => matched.has(l.id))) out.push(row);
  }
  return out;
}
