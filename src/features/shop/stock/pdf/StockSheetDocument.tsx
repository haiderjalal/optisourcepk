import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatPower } from "@/lib/format";
import type { StockSheet } from "@/services/shop/stock.service";

/**
 * The "Lens Stock Detail List" as it is printed in the shop: company header,
 * product name, then SPH down the side, CYL across the top, every cell ruled,
 * and a total under each column.
 *
 * Plain black rules, no colour: it goes to a black-and-white printer as often
 * as it goes to WhatsApp. The header row repeats on every page, so a long
 * range still reads when it runs onto a second sheet.
 */

export interface StockSheetPdfModel {
  companyName: string;
  addressLine: string;
  productName: string;
  printedAt: string;
  unit: string;
  sheet: StockSheet;
}

const INK = "#111111";
const RULE = "#333333";

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 22,
    fontSize: 8,
    fontFamily: "Times-Roman",
    color: INK,
  },
  printedAt: { fontSize: 7, marginBottom: 4 },
  company: {
    fontSize: 16,
    fontFamily: "Times-Bold",
    textAlign: "center",
  },
  address: {
    fontSize: 11,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginTop: 2,
  },
  title: {
    fontSize: 12,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginTop: 6,
  },
  product: {
    fontSize: 11,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginTop: 3,
    marginBottom: 8,
  },
  table: {
    borderTop: `0.75pt solid ${RULE}`,
    borderLeft: `0.75pt solid ${RULE}`,
  },
  row: { flexDirection: "row" },
  cell: {
    borderRight: `0.75pt solid ${RULE}`,
    borderBottom: `0.75pt solid ${RULE}`,
    paddingVertical: 2.5,
    paddingHorizontal: 3,
  },
  headCell: { fontFamily: "Times-Bold", textAlign: "center" },
  rowHead: { fontFamily: "Times-Bold", textAlign: "center" },
  qty: { textAlign: "left" },
  total: { fontFamily: "Times-Bold" },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 22,
    right: 22,
    fontSize: 7,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const key = (sph: number, cyl: number | null) => `${sph}|${cyl ?? ""}`;

export function StockSheetDocument({ model }: { model: StockSheetPdfModel }) {
  const { sphs, cyls, cells } = model.sheet;
  const byCyl = cyls[0] !== null || cyls.length > 1;

  // Fixed percentages so every page of one sheet lines up exactly.
  const firstWidth = cyls.length > 12 ? 9 : 12;
  const colWidth = `${(100 - firstWidth) / cyls.length}%`;
  const first = `${firstWidth}%`;

  const columnTotal = (cyl: number | null) =>
    sphs.reduce((sum, sph) => sum + (cells[key(sph, cyl)]?.qty ?? 0), 0);
  const grandTotal = cyls.reduce<number>(
    (sum, cyl) => sum + columnTotal(cyl),
    0,
  );

  return (
    <Document title={`Stock — ${model.productName}`} author={model.companyName}>
      <Page
        size="A4"
        orientation={cyls.length > 10 ? "landscape" : "portrait"}
        style={styles.page}
      >
        <Text style={styles.printedAt}>{model.printedAt}</Text>
        <Text style={styles.company}>{model.companyName}</Text>
        <Text style={styles.address}>{model.addressLine}</Text>
        <Text style={styles.title}>Lens Stock Detail List</Text>
        <Text style={styles.product}>Product Name : {model.productName}</Text>

        <View style={styles.table}>
          <View style={styles.row} fixed>
            <Text style={[styles.cell, styles.headCell, { width: first }]}>
              {byCyl ? "SPH | CYL" : "SPH"}
            </Text>
            {cyls.map((cyl) => (
              <Text
                key={cyl ?? "none"}
                style={[styles.cell, styles.headCell, { width: colWidth }]}
              >
                {byCyl ? formatPower(cyl ?? 0) : "Qty"}
              </Text>
            ))}
          </View>

          {sphs.map((sph) => (
            <View key={sph} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.rowHead, { width: first }]}>
                {formatPower(sph)}
              </Text>
              {cyls.map((cyl) => (
                <Text
                  key={cyl ?? "none"}
                  style={[styles.cell, styles.qty, { width: colWidth }]}
                >
                  {cells[key(sph, cyl)]?.qty ?? 0}
                </Text>
              ))}
            </View>
          ))}

          <View style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.total, { width: first }]}>
              Total
            </Text>
            {cyls.map((cyl) => (
              <Text
                key={cyl ?? "none"}
                style={[styles.cell, styles.total, { width: colWidth }]}
              >
                {columnTotal(cyl)}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Total on hand: {grandTotal} {model.unit}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
