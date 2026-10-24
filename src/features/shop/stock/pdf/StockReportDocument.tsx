import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { MUTED, NAVY, RULE } from "@/features/shop/pdf/theme";
import type {
  StockPdfRow,
  StockPdfSection,
  StockReportPdfModel,
} from "./model";

/**
 * The stock report as a PDF: purchases from suppliers, the daily stock register,
 * and the invoices that sold from it, one table each.
 *
 * The same family as the RX lab report and the ledger. Column widths are fixed
 * percentages that sum to 100, so each table reads the same every time it is
 * printed.
 */

type Align = "left" | "right" | "center";

interface Column {
  label: string;
  width: string;
  align: Align;
}

const PURCHASE_COLUMNS: Column[] = [
  { label: "Date", width: "10%", align: "left" },
  { label: "Invoice", width: "10%", align: "left" },
  { label: "Supplier", width: "16%", align: "left" },
  { label: "Product", width: "17%", align: "left" },
  { label: "Power", width: "21%", align: "left" },
  { label: "Eye", width: "4%", align: "center" },
  { label: "Qty", width: "6%", align: "right" },
  { label: "Unit cost", width: "7%", align: "right" },
  { label: "Amount", width: "9%", align: "right" },
];

const REGISTER_COLUMNS: Column[] = [
  { label: "Date", width: "11%", align: "left" },
  { label: "Item", width: "27%", align: "left" },
  { label: "Unit", width: "6%", align: "left" },
  { label: "Opening", width: "9%", align: "right" },
  { label: "Received", width: "10%", align: "right" },
  { label: "Sold", width: "10%", align: "right" },
  { label: "Closing", width: "9%", align: "right" },
  { label: "Note", width: "18%", align: "left" },
];

const SALES_COLUMNS: Column[] = [
  { label: "Date", width: "11%", align: "left" },
  { label: "Invoice", width: "9%", align: "left" },
  { label: "Shop", width: "30%", align: "left" },
  { label: "Item", width: "27%", align: "left" },
  { label: "Qty", width: "8%", align: "right" },
  { label: "Amount", width: "15%", align: "right" },
];

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 28,
    fontSize: 7.5,
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

  section: { marginBottom: 12 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 4,
  },
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
  cell: { paddingHorizontal: 3 },
  left: { textAlign: "left" },
  right: { textAlign: "right" },
  centre: { textAlign: "center" },
  flagged: { color: "#b45309" },
  empty: { color: MUTED, textAlign: "center", paddingVertical: 10 },

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

function alignStyle(align: Align) {
  if (align === "right") return styles.right;
  if (align === "center") return styles.centre;
  return styles.left;
}

export function StockReportDocument({
  model,
  logo,
}: {
  model: StockReportPdfModel;
  /** Data URL for the brand mark. Omitted in tests, where fonts are all we need. */
  logo?: string;
}) {
  return (
    <Document
      title={`Stock report, ${model.period}`}
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
            <Text style={styles.title}>STOCK REPORT</Text>
            <Text style={styles.period}>{model.period}</Text>
          </View>
        </View>

        <Section section={model.purchases} columns={PURCHASE_COLUMNS} />
        <Section section={model.register} columns={REGISTER_COLUMNS} />
        <Section section={model.sales} columns={SALES_COLUMNS} />

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

function Section({
  section,
  columns,
}: {
  section: StockPdfSection;
  columns: Column[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>

      <View style={styles.tableHead} fixed>
        {columns.map((column) => (
          <Text
            key={column.label}
            style={[
              styles.cell,
              { width: column.width },
              alignStyle(column.align),
            ]}
          >
            {column.label}
          </Text>
        ))}
      </View>

      {section.rows.length === 0 ? (
        <Text style={styles.empty}>No entries in this range.</Text>
      ) : (
        section.rows.map((row) => (
          <ReportLine key={row.key} row={row} columns={columns} />
        ))
      )}

      {section.rows.length > 0 && (
        <View style={styles.totalRow} wrap={false}>
          {columns.map((column, index) => (
            <Text
              key={column.label}
              style={[
                styles.cell,
                { width: column.width },
                alignStyle(column.align),
              ]}
            >
              {section.total[index]}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function ReportLine({ row, columns }: { row: StockPdfRow; columns: Column[] }) {
  const last = columns.length - 1;
  return (
    <View style={styles.row} wrap={false}>
      {columns.map((column, index) => (
        <Text
          key={column.label}
          style={[
            styles.cell,
            { width: column.width },
            alignStyle(column.align),
            row.flagged && index === last ? styles.flagged : {},
          ]}
        >
          {row.cells[index]}
        </Text>
      ))}
    </View>
  );
}
