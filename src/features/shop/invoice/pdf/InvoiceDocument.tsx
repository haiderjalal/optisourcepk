import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { InvoicePdfLine, InvoicePdfModel } from "./model";

/**
 * The OptiSource invoice.
 *
 * Reproduces the layout the trade already recognises: a small company header,
 * the invoice number twice, three party boxes, a line table carrying the
 * prescription columns, and a nine-row totals block.
 *
 * Column widths are fixed percentages that sum to 100 so the table cannot
 * reflow between one invoice and the next — an invoice must look the same
 * every time it is printed.
 */

const COLUMNS = {
  no: "3%",
  order: "8%",
  ref: "4%",
  product: "27%",
  sph: "7%",
  cyl: "7%",
  ax: "5%",
  add: "6%",
  price: "9%",
  discount: "8%",
  qty: "5%",
  total: "11%",
} as const;

const NAVY = "#0f2741";
const RULE = "#9aa8bd";
const MUTED = "#5b6b84";

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
    fontSize: 7.5,
    fontFamily: "Helvetica",
    color: NAVY,
  },

  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 34, height: 22, objectFit: "contain", marginRight: 8 },
  headerLabel: { width: 46, color: MUTED },
  headerValue: { flex: 1 },
  headerLine: { flexDirection: "row", marginBottom: 1.5 },

  invoiceNoSmall: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },

  title: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 1,
  },

  boxes: { flexDirection: "row", borderTop: `1pt solid ${RULE}` },
  box: {
    flex: 1,
    borderRight: `1pt solid ${RULE}`,
    borderBottom: `1pt solid ${RULE}`,
    borderLeft: `1pt solid ${RULE}`,
    paddingVertical: 4,
    paddingHorizontal: 5,
    minHeight: 40,
  },
  boxLast: { borderRight: `1pt solid ${RULE}` },
  boxLabel: { color: MUTED, fontSize: 6.5, marginBottom: 1 },
  boxName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  // Tuned by rendering, not derived: react-pdf resolves lineHeight against a
  // larger internal line box than the font size, so 0.65 here lands at about
  // 11pt of leading on 7.5pt text. Anything near 1.2 double-spaces an address.
  boxLine: { color: MUTED, lineHeight: 0.65 },

  tableHead: {
    flexDirection: "row",
    backgroundColor: "#eef2f7",
    borderBottom: `1pt solid ${RULE}`,
    borderLeft: `1pt solid ${RULE}`,
    borderRight: `1pt solid ${RULE}`,
    paddingVertical: 3,
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    borderBottom: `0.5pt solid #d9e0ea`,
    borderLeft: `1pt solid ${RULE}`,
    borderRight: `1pt solid ${RULE}`,
    paddingVertical: 2.5,
  },
  cell: { paddingHorizontal: 3 },
  right: { textAlign: "right" },
  centre: { textAlign: "center" },

  summaryRow: { flexDirection: "row", marginTop: 6 },
  qtyBlock: { flex: 1, paddingTop: 2 },
  qtyLine: { flexDirection: "row", marginBottom: 2 },
  qtyLabel: { color: MUTED, marginRight: 4 },
  qtyValue: { fontFamily: "Helvetica-Bold" },

  totals: { width: "44%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.8,
  },
  totalStrong: {
    borderTop: `1pt solid ${RULE}`,
    marginTop: 2,
    paddingTop: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
  },

  voided: {
    position: "absolute",
    top: 300,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 60,
    fontFamily: "Helvetica-Bold",
    color: "#c0392b",
    opacity: 0.16,
  },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    color: MUTED,
    fontSize: 6.5,
  },
});

function HeadCell({
  width,
  label,
  align,
}: {
  width: string;
  label: string;
  align?: "right" | "center";
}) {
  return (
    <Text
      style={[
        styles.cell,
        { width },
        align === "right"
          ? styles.right
          : align === "center"
            ? styles.centre
            : {},
      ]}
    >
      {label}
    </Text>
  );
}

function Party({
  label,
  name,
  lines,
  last,
}: {
  label: string;
  name: string;
  lines: string[];
  last?: boolean;
}) {
  return (
    <View style={[styles.box, last ? styles.boxLast : {}]}>
      <Text style={styles.boxLabel}>{label}</Text>
      <Text style={styles.boxName}>{name}</Text>
      {/* One Text with newlines, not one per line: react-pdf lays each Text
          out as its own block, which double-spaces an address. */}
      {lines.length > 0 && (
        <Text style={styles.boxLine}>{lines.join("\n")}</Text>
      )}
    </View>
  );
}

function Row({ line }: { line: InvoicePdfLine }) {
  return (
    <View style={styles.row} wrap={false}>
      <Text style={[styles.cell, { width: COLUMNS.no }]}>{line.no}</Text>
      <Text style={[styles.cell, { width: COLUMNS.order }]}>
        {line.orderRef}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.ref }, styles.centre]}>
        {line.eye}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.product }]}>
        {line.product}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.sph }, styles.right]}>
        {line.sph}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.cyl }, styles.right]}>
        {line.cyl}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.ax }, styles.right]}>
        {line.ax}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.add }, styles.right]}>
        {line.add}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.price }, styles.right]}>
        {line.price}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.discount }, styles.right]}>
        {line.discount}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.qty }, styles.right]}>
        {line.qty}
      </Text>
      <Text style={[styles.cell, { width: COLUMNS.total }, styles.right]}>
        {line.total}
      </Text>
    </View>
  );
}

export function InvoiceDocument({
  model,
  logo,
}: {
  model: InvoicePdfModel;
  /** Data URL for the brand mark. Omitted in tests, where fonts are all we need. */
  logo?: string;
}) {
  return (
    <Document
      title={`Invoice ${model.invoiceNo}`}
      author={model.company.name}
      creator={model.company.name}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text --
              react-pdf.s Image is a PDF primitive, not an <img>: it has no alt
              prop. The mark is decorative here; the company name is adjacent
              as real text. */}
          {logo && <Image src={logo} style={styles.logo} />}

          <View style={{ flex: 1 }}>
            <View style={styles.headerLine}>
              <Text style={styles.headerLabel}>Company</Text>
              <Text
                style={[styles.headerValue, { fontFamily: "Helvetica-Bold" }]}
              >
                {model.company.name}
              </Text>
            </View>
            <View style={styles.headerLine}>
              <Text style={styles.headerLabel}>Address</Text>
              <Text style={styles.headerValue}>{model.company.address}</Text>
            </View>
            <View style={styles.headerLine}>
              <Text style={styles.headerLabel}>Phone</Text>
              <Text style={styles.headerValue}>{model.company.phone}</Text>
            </View>
          </View>

          <View style={{ width: 130 }}>
            <Text style={styles.invoiceNoSmall}>INVOICE {model.invoiceNo}</Text>
            <Text style={[styles.right, { color: MUTED, marginTop: 2 }]}>
              {model.issuedAt}
            </Text>
            {model.priority !== "" && (
              <Text
                style={[
                  styles.right,
                  {
                    color: "#c0392b",
                    fontFamily: "Helvetica-Bold",
                    marginTop: 2,
                  },
                ]}
              >
                {model.priority}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.headerLine, { marginTop: 4 }]}>
          <Text style={styles.headerLabel}>Courier</Text>
          <Text style={{ width: 150 }}>{model.courier || "—"}</Text>
          <Text style={styles.headerLabel}>Tracking</Text>
          <Text style={styles.headerValue}>{model.trackingNo || "—"}</Text>
        </View>

        <Text style={styles.title}>INVOICE {model.invoiceNo}</Text>

        <View style={styles.boxes}>
          <Party
            label="Order By"
            name={model.orderBy.name}
            lines={model.orderBy.lines}
          />
          <Party
            label="Deliver To"
            name={model.deliverTo.name}
            lines={model.deliverTo.lines}
          />
          <Party
            label="Invoice To"
            name={model.invoiceTo.name}
            lines={model.invoiceTo.lines}
            last
          />
        </View>

        {/* `fixed` repeats the header on every page of a long invoice. */}
        <View style={styles.tableHead} fixed>
          <HeadCell width={COLUMNS.no} label="#" />
          <HeadCell width={COLUMNS.order} label="Order" />
          <HeadCell width={COLUMNS.ref} label="Ref" align="center" />
          <HeadCell width={COLUMNS.product} label="Product" />
          <HeadCell width={COLUMNS.sph} label="SPH" align="right" />
          <HeadCell width={COLUMNS.cyl} label="CYL" align="right" />
          <HeadCell width={COLUMNS.ax} label="AX" align="right" />
          <HeadCell width={COLUMNS.add} label="ADD" align="right" />
          <HeadCell width={COLUMNS.price} label="Price" align="right" />
          <HeadCell width={COLUMNS.discount} label="Discount" align="right" />
          <HeadCell width={COLUMNS.qty} label="Qty" align="right" />
          <HeadCell width={COLUMNS.total} label="Total" align="right" />
        </View>

        {model.lines.map((line) => (
          <Row key={line.no} line={line} />
        ))}

        <View style={styles.summaryRow} wrap={false}>
          <View style={styles.qtyBlock}>
            <View style={styles.qtyLine}>
              <Text style={styles.qtyLabel}>Order Qty:</Text>
              <Text style={styles.qtyValue}>{model.orderQty}</Text>
              <Text style={[styles.qtyLabel, { marginLeft: 14 }]}>
                Lens Qty:
              </Text>
              <Text style={styles.qtyValue}>{model.lensQty}</Text>
            </View>
          </View>

          <View style={styles.totals}>
            {model.totals.map((total) => (
              <View
                key={total.label}
                style={[
                  styles.totalRow,
                  total.strong ? styles.totalStrong : {},
                ]}
              >
                <Text>{total.label}</Text>
                <Text>{total.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {model.voided && <Text style={styles.voided}>VOID</Text>}

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
