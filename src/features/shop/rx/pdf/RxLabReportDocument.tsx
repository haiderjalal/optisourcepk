import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { MUTED, NAVY, RULE } from "@/features/shop/pdf/theme";
import type { RxLabPdfModel, RxLabPdfRow } from "./model";

/**
 * The RX lab report as a PDF: one line per RX order, then the totals.
 *
 * The same family as the invoice and the ledger: a company header, the period
 * it covers, then a table. Column widths are fixed percentages that sum to 100,
 * so the report reads the same every time it is printed.
 */

const COLUMNS = {
  rx: "9%",
  // Wide enough for "21-Oct-2026" on one line.
  date: "13%",
  labNo: "11%",
  lab: "10%",
  patient: "24%",
  lenses: "7%",
  purchase: "13%",
  sale: "13%",
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: NAVY,
  },

  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  logo: { width: 40, height: 26, objectFit: "contain", marginRight: 10 },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 },
  muted: { color: MUTED },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    letterSpacing: 0.5,
    textAlign: "right",
  },
  period: { color: MUTED, textAlign: "right", marginTop: 3 },

  tableHead: {
    flexDirection: "row",
    backgroundColor: "#eef2f7",
    borderTop: `1pt solid ${RULE}`,
    borderBottom: `1pt solid ${RULE}`,
    borderLeft: `1pt solid ${RULE}`,
    borderRight: `1pt solid ${RULE}`,
    paddingVertical: 3,
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #d9e0ea",
    borderLeft: `1pt solid ${RULE}`,
    borderRight: `1pt solid ${RULE}`,
    paddingVertical: 2.5,
  },
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#f7f9fc",
    borderBottom: `1pt solid ${RULE}`,
    borderLeft: `1pt solid ${RULE}`,
    borderRight: `1pt solid ${RULE}`,
    paddingVertical: 3,
    fontFamily: "Helvetica-Bold",
  },
  cell: { paddingHorizontal: 4 },
  right: { textAlign: "right" },
  voidMark: { color: MUTED, fontSize: 7 },
  shop: { color: MUTED, fontSize: 7 },
  empty: { color: MUTED, textAlign: "center", paddingVertical: 14 },

  note: { color: MUTED, fontSize: 7, marginTop: 4 },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    color: MUTED,
    fontSize: 6.5,
  },
});

export function RxLabReportDocument({
  model,
  logo,
}: {
  model: RxLabPdfModel;
  /** Data URL for the brand mark. Omitted in tests, where fonts are all we need. */
  logo?: string;
}) {
  return (
    <Document
      title={`RX lab report, ${model.period}`}
      author={model.company.name}
      creator={model.company.name}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text --
              react-pdf's Image is a PDF primitive, not an <img>: it has no alt
              prop. The mark is decorative; the company name is adjacent text. */}
          {logo && <Image src={logo} style={styles.logo} />}

          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>{model.company.name}</Text>
            <Text style={styles.muted}>{model.company.address}</Text>
            <Text style={styles.muted}>{model.company.phone}</Text>
          </View>

          <View style={{ width: 230 }}>
            <Text style={styles.title}>RX LAB REPORT</Text>
            <Text style={styles.period}>{model.period}</Text>
          </View>
        </View>

        {/* `fixed` repeats the header on every page of a long report. */}
        <View style={styles.tableHead} fixed>
          <Text style={[styles.cell, { width: COLUMNS.rx }]}>RX no.</Text>
          <Text style={[styles.cell, { width: COLUMNS.date }]}>Date</Text>
          <Text style={[styles.cell, { width: COLUMNS.labNo }]}>
            Lab order no.
          </Text>
          <Text style={[styles.cell, { width: COLUMNS.lab }]}>Lab</Text>
          <Text style={[styles.cell, { width: COLUMNS.patient }]}>
            Patient / shop
          </Text>
          <Text style={[styles.cell, styles.right, { width: COLUMNS.lenses }]}>
            Lenses
          </Text>
          <Text
            style={[styles.cell, styles.right, { width: COLUMNS.purchase }]}
          >
            Purchase
          </Text>
          <Text style={[styles.cell, styles.right, { width: COLUMNS.sale }]}>
            Sale
          </Text>
        </View>

        {model.rows.length === 0 && (
          <Text style={styles.empty}>No RX orders dated in this range.</Text>
        )}
        {model.rows.map((row) => (
          <ReportLine key={row.key} row={row} />
        ))}

        {model.rows.length > 0 && (
          <View style={styles.totalRow} wrap={false}>
            <Text style={[styles.cell, { flex: 1 }]}>{model.totals.label}</Text>
            <Text
              style={[styles.cell, styles.right, { width: COLUMNS.lenses }]}
            >
              {model.totals.lenses}
            </Text>
            <Text
              style={[styles.cell, styles.right, { width: COLUMNS.purchase }]}
            >
              {model.totals.purchase}
            </Text>
            <Text style={[styles.cell, styles.right, { width: COLUMNS.sale }]}>
              {model.totals.sale}
            </Text>
          </View>
        )}

        <Text style={styles.note}>
          Amounts in Rs. Purchase is what the lab charges and sale is what the
          shop bills, each summed over the lenses of the order.
        </Text>
        {model.notes.map((note) => (
          <Text key={note} style={styles.note}>
            {note}
          </Text>
        ))}

        <View style={styles.footer} fixed>
          <Text>
            {model.company.name} · {model.company.phone}
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

function ReportLine({ row }: { row: RxLabPdfRow }) {
  // A voided order stays on the page, but in the muted ink, as the screen shows it.
  const ink = row.voided ? { color: MUTED } : undefined;

  return (
    <View style={styles.row} wrap={false}>
      <View style={[styles.cell, { width: COLUMNS.rx }]}>
        <Text style={ink}>{row.rxNo}</Text>
        {row.voided && <Text style={styles.voidMark}>Void</Text>}
      </View>
      <Text style={[styles.cell, { width: COLUMNS.date }, ink]}>
        {row.date}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.labNo }, ink]}>
        {row.labOrderNo}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.lab }, ink]}>{row.lab}</Text>
      <View style={[styles.cell, { width: COLUMNS.patient }]}>
        <Text style={ink}>{row.patient}</Text>
        <Text style={styles.shop}>{row.shop}</Text>
      </View>
      <Text style={[styles.cell, styles.right, { width: COLUMNS.lenses }, ink]}>
        {row.lenses}
      </Text>
      <Text
        style={[
          styles.cell,
          styles.right,
          { width: COLUMNS.purchase },
          row.purchaseMissing ? { color: "#b45309" } : ink,
        ]}
      >
        {row.purchase}
      </Text>
      <Text style={[styles.cell, styles.right, { width: COLUMNS.sale }, ink]}>
        {row.sale}
      </Text>
    </View>
  );
}
