import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { MUTED, NAVY, RULE } from "@/features/shop/pdf/theme";
import type { LedgerPdfModel, LedgerPdfRow } from "./model";

/**
 * The customer ledger as a statement of account.
 *
 * The same family as the invoice: a company header, the account it is for, a
 * row of headline figures, then one dated line per entry with its running
 * balance. Column widths are fixed percentages that sum to 100, so the table
 * reads the same every time it is printed.
 */

const COLUMNS = {
  date: "13%",
  detail: "47%",
  debit: "13%",
  credit: "13%",
  balance: "14%",
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
  asOf: { color: MUTED, textAlign: "right", marginTop: 3 },

  accountBox: {
    borderTop: `1pt solid ${RULE}`,
    borderBottom: `1pt solid ${RULE}`,
    borderLeft: `1pt solid ${RULE}`,
    borderRight: `1pt solid ${RULE}`,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 10,
  },
  accountLabel: { color: MUTED, fontSize: 7, marginBottom: 1 },
  accountName: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 1 },
  // One Text with newlines, not one per line: react-pdf lays each Text out as
  // its own block, which double-spaces an address (see InvoiceDocument).
  accountLines: { color: MUTED, lineHeight: 0.65, marginTop: 2 },

  summary: {
    flexDirection: "row",
    borderTop: `1pt solid ${RULE}`,
    borderBottom: `1pt solid ${RULE}`,
    borderLeft: `1pt solid ${RULE}`,
    borderRight: `1pt solid ${RULE}`,
    marginBottom: 12,
  },
  summaryCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRight: `1pt solid ${RULE}`,
  },
  summaryClosing: { flex: 1.2, borderRight: 0, backgroundColor: "#f7f9fc" },
  summaryLabel: { color: MUTED, fontSize: 7, marginBottom: 2 },
  summaryValue: { fontFamily: "Helvetica-Bold", fontSize: 9 },

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
  cell: { paddingHorizontal: 4 },
  right: { textAlign: "right" },
  detailNote: { color: MUTED, fontSize: 7 },
  empty: { color: MUTED, textAlign: "center", paddingVertical: 14 },

  note: { color: MUTED, fontSize: 7, marginTop: 10 },

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

export function LedgerDocument({
  model,
  logo,
}: {
  model: LedgerPdfModel;
  /** Data URL for the brand mark. Omitted in tests, where fonts are all we need. */
  logo?: string;
}) {
  return (
    <Document
      title={`Statement of account — ${model.shopName}`}
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

          <View style={{ width: 170 }}>
            <Text style={styles.title}>STATEMENT OF ACCOUNT</Text>
            <Text style={styles.asOf}>As of {model.asOf}</Text>
          </View>
        </View>

        <View style={styles.accountBox}>
          <Text style={styles.accountLabel}>Account</Text>
          <Text style={styles.accountName}>{model.shopName}</Text>
          <Text style={styles.muted}>{model.owner}</Text>
          {model.addressLines.length > 0 && (
            <Text style={styles.accountLines}>
              {model.addressLines.join("\n")}
            </Text>
          )}
        </View>

        <View style={styles.summary}>
          {model.summary.map((item) => (
            <View key={item.label} style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
          <View style={[styles.summaryCell, styles.summaryClosing]}>
            <Text style={styles.summaryLabel}>{model.closingLabel}</Text>
            <Text style={styles.summaryValue}>{model.closingValue}</Text>
          </View>
        </View>

        {/* `fixed` repeats the header on every page of a long ledger. */}
        <View style={styles.tableHead} fixed>
          <Text style={[styles.cell, { width: COLUMNS.date }]}>Date</Text>
          <Text style={[styles.cell, { width: COLUMNS.detail }]}>Detail</Text>
          <Text style={[styles.cell, styles.right, { width: COLUMNS.debit }]}>
            Debit
          </Text>
          <Text style={[styles.cell, styles.right, { width: COLUMNS.credit }]}>
            Credit
          </Text>
          <Text style={[styles.cell, styles.right, { width: COLUMNS.balance }]}>
            Balance
          </Text>
        </View>

        {model.rows.length === 0 && (
          <Text style={styles.empty}>No entries yet.</Text>
        )}
        {model.rows.map((row) => (
          <LedgerLine key={row.key} row={row} />
        ))}

        <Text style={styles.note}>
          Amounts in Rs. A positive balance is what the shop owes. Negative
          means they are in credit.
        </Text>

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

function LedgerLine({ row }: { row: LedgerPdfRow }) {
  return (
    <View style={styles.row} wrap={false}>
      <Text style={[styles.cell, { width: COLUMNS.date }]}>{row.date}</Text>
      <View style={[styles.cell, { width: COLUMNS.detail }]}>
        <Text>{row.detail}</Text>
        {row.note !== "" && <Text style={styles.detailNote}>{row.note}</Text>}
      </View>
      <Text style={[styles.cell, styles.right, { width: COLUMNS.debit }]}>
        {row.debit}
      </Text>
      <Text style={[styles.cell, styles.right, { width: COLUMNS.credit }]}>
        {row.credit}
      </Text>
      <Text style={[styles.cell, styles.right, { width: COLUMNS.balance }]}>
        {row.balance}
      </Text>
    </View>
  );
}
