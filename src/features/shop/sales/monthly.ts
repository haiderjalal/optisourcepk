/**
 * Monthly sales by channel. Pure: the database totals each month and channel (see 0042_sales_monthly_views.sql), and
 * this file lays those totals out as one row per month. Product breakdowns for a single month are still totalled here.
 *
 * The rules match the RX monthly figures: an issued invoice counts and a voided one does not. Sales are line totals
 * after discount and before freight and tax. A line's channel is RX when it has an RX status, daily when it draws on
 * the daily stock register, and stock otherwise. Cost is known only where a line stores a unit cost; lines without one
 * are counted separately rather than treated as free.
 */

export const CHANNELS = ["rx", "stock", "daily"] as const;
export type SalesChannel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<SalesChannel, string> = {
  rx: "RX",
  stock: "Stock",
  daily: "Daily stock",
};

export interface SaleLine {
  productId: string;
  productName: string;
  quantity: number;
  lineTotal: number;
  unitCost: number | null;
  isRx: boolean;
  isDaily: boolean;
  issuedAt: string;
}

/** One channel's totals for one Karachi month, summed by the database. */
export interface ChannelTotal {
  /** Karachi calendar month, "YYYY-MM". */
  month: string;
  channel: SalesChannel;
  sales: number;
  cost: number;
  knownSales: number;
  linesWithoutCost: number;
}

/** The returns made in one Karachi month, summed by the database. */
export interface MonthReturnTotal {
  /** Karachi calendar month, "YYYY-MM". */
  month: string;
  amount: number;
}

export interface ChannelFigures {
  sales: number;
  cost: number;
  /** Sales of the lines whose cost is known; profit is measured against these only. */
  knownSales: number;
  profit: number;
  linesWithoutCost: number;
}

export interface MonthRow {
  /** Karachi calendar month, "YYYY-MM". */
  month: string;
  channels: Record<SalesChannel, ChannelFigures>;
  sales: number;
  returns: number;
  net: number;
}

export interface ProductRow {
  productId: string;
  productName: string;
  channel: SalesChannel;
  quantity: number;
  sales: number;
  cost: number;
  knownSales: number;
  profit: number;
  linesWithoutCost: number;
}

/** The UTC instants at which a Karachi calendar month starts and ends. Karachi is UTC+5 all year round. */
export function karachiMonthBounds(month: string): {
  start: string;
  end: string;
} {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1, -5)).toISOString(),
    end: new Date(Date.UTC(year, monthNumber, 1, -5)).toISOString(),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyFigures(): ChannelFigures {
  return { sales: 0, cost: 0, knownSales: 0, profit: 0, linesWithoutCost: 0 };
}

function channelOf(line: SaleLine): SalesChannel {
  if (line.isRx) return "rx";
  return line.isDaily ? "daily" : "stock";
}

function addLine(figures: ChannelFigures, line: SaleLine): void {
  figures.sales += line.lineTotal;
  if (line.unitCost === null) {
    figures.linesWithoutCost += 1;
    return;
  }
  figures.cost += line.unitCost * line.quantity;
  figures.knownSales += line.lineTotal;
}

function settle(figures: ChannelFigures): void {
  figures.sales = round2(figures.sales);
  figures.cost = round2(figures.cost);
  figures.knownSales = round2(figures.knownSales);
  figures.profit = round2(figures.knownSales - figures.cost);
}

/**
 * One row per Karachi month, newest first, with each channel's figures and the month's returns netted off.
 *
 * The totals arrive already summed per month and channel, so this only gathers and settles them.
 */
export function monthlySalesFromTotals(
  channels: ChannelTotal[],
  returns: MonthReturnTotal[],
): MonthRow[] {
  const months = new Map<string, MonthRow>();
  const rowFor = (month: string): MonthRow => {
    const existing = months.get(month);
    if (existing) return existing;
    const created: MonthRow = {
      month,
      channels: {
        rx: emptyFigures(),
        stock: emptyFigures(),
        daily: emptyFigures(),
      },
      sales: 0,
      returns: 0,
      net: 0,
    };
    months.set(month, created);
    return created;
  };

  for (const total of channels) {
    const figures = rowFor(total.month).channels[total.channel];
    figures.sales += total.sales;
    figures.cost += total.cost;
    figures.knownSales += total.knownSales;
    figures.linesWithoutCost += total.linesWithoutCost;
  }
  for (const ret of returns) {
    rowFor(ret.month).returns += ret.amount;
  }

  for (const row of months.values()) {
    for (const channel of CHANNELS) settle(row.channels[channel]);
    row.sales = round2(
      CHANNELS.reduce(
        (total, channel) => total + row.channels[channel].sales,
        0,
      ),
    );
    row.returns = round2(row.returns);
    row.net = round2(row.sales - row.returns);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}

/** Sales for one month broken down by product and channel, largest sales first. */
export function productSales(lines: SaleLine[]): ProductRow[] {
  const products = new Map<
    string,
    { row: ProductRow; figures: ChannelFigures }
  >();
  for (const line of lines) {
    const channel = channelOf(line);
    const key = `${channel}:${line.productId}`;
    let entry = products.get(key);
    if (!entry) {
      entry = {
        row: {
          productId: line.productId,
          productName: line.productName,
          channel,
          quantity: 0,
          sales: 0,
          cost: 0,
          knownSales: 0,
          profit: 0,
          linesWithoutCost: 0,
        },
        figures: emptyFigures(),
      };
      products.set(key, entry);
    }
    entry.row.quantity += line.quantity;
    addLine(entry.figures, line);
  }

  return [...products.values()]
    .map(({ row, figures }) => {
      settle(figures);
      return {
        ...row,
        sales: figures.sales,
        cost: figures.cost,
        knownSales: figures.knownSales,
        profit: figures.profit,
        linesWithoutCost: figures.linesWithoutCost,
      };
    })
    .sort((a, b) => b.sales - a.sales);
}
