import { Document, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandedPage, PdfSection, PdfTable, StatStrip, type PdfColumn } from "@/components/pcready/pdf/shared";
import { pdfFonts, pdfPalette } from "@/components/pcready/pdf/theme";

type InvoiceItem = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  item_type?: string;
};

type BillingPdfProps = {
  title: string;
  number: string;
  status?: string;
  issueDate: string;
  dueDate?: string | null;
  senderName?: string | null;
  senderAddress?: string | null;
  recipientName?: string | null;
  recipientAddress?: string | null;
  notes?: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount?: number;
  items: InvoiceItem[];
};

const styles = StyleSheet.create({
  twoCols: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  party: {
    flexGrow: 1,
    flexBasis: 0,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 8,
    backgroundColor: pdfPalette.paper,
    padding: 10,
  },
  label: {
    fontSize: 7,
    color: pdfPalette.muted,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  name: {
    fontFamily: pdfFonts.bold,
    fontSize: 11,
    marginBottom: 4,
  },
  text: {
    fontSize: 8,
    lineHeight: 1.35,
    color: pdfPalette.ink,
  },
  note: {
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 8,
    backgroundColor: pdfPalette.surface,
    padding: 10,
    fontSize: 8,
    lineHeight: 1.35,
  },
});

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}

/**
 *
 */
export function InvoicePdf(props: BillingPdfProps) {
  return <BillingPdf {...props} title={props.title || "Fattura"} />;
}

/**
 *
 */
export function QuotePdf(props: BillingPdfProps) {
  return <BillingPdf {...props} title={props.title || "Preventivo"} />;
}

function BillingPdf({
  title,
  number,
  status,
  issueDate,
  dueDate,
  senderName,
  senderAddress,
  recipientName,
  recipientAddress,
  notes,
  subtotal,
  taxRate,
  taxAmount,
  total,
  paidAmount = 0,
  items,
}: BillingPdfProps) {
  const columns: PdfColumn<InvoiceItem>[] = [
    { key: "description", label: "Descrizione", width: "46%", value: (row) => row.description },
    { key: "type", label: "Tipo", width: "14%", value: (row) => row.item_type ?? "servizio" },
    { key: "qty", label: "Q.ta", width: "12%", mono: true, value: (row) => String(row.quantity) },
    { key: "unit", label: "Prezzo", width: "14%", mono: true, value: (row) => formatCurrency(row.unit_price) },
    {
      key: "total",
      label: "Totale",
      width: "14%",
      mono: true,
      value: (row) => formatCurrency(row.line_total ?? row.quantity * row.unit_price),
    },
  ];

  return (
    <Document author="PCReady" title={`${title} ${number}`}>
      <BrandedPage title={title} meta={number}>
        <StatStrip
          stats={[
            { label: "Data", value: issueDate, color: pdfPalette.accent },
            { label: "Scadenza", value: dueDate || "-", color: pdfPalette.info },
            { label: "Stato", value: status || "bozza", color: pdfPalette.warn },
            { label: "Totale", value: formatCurrency(total), color: pdfPalette.success },
          ]}
        />
        <View style={styles.twoCols}>
          <View style={styles.party}>
            <Text style={styles.label}>Emittente</Text>
            <Text style={styles.name}>{senderName || "PCReady"}</Text>
            <Text style={styles.text}>{senderAddress || "-"}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.name}>{recipientName || "-"}</Text>
            <Text style={styles.text}>{recipientAddress || "-"}</Text>
          </View>
        </View>
        <PdfSection title="Voci" meta={`${items.length} righe`}>
          <PdfTable rows={items} columns={columns} />
        </PdfSection>
        <StatStrip
          stats={[
            { label: "Imponibile", value: formatCurrency(subtotal), color: pdfPalette.accent },
            { label: `IVA ${taxRate}%`, value: formatCurrency(taxAmount), color: pdfPalette.info },
            { label: "Pagato", value: formatCurrency(paidAmount), color: pdfPalette.warn },
            { label: "Saldo", value: formatCurrency(Math.max(0, total - paidAmount)), color: pdfPalette.success },
          ]}
        />
        {notes ? (
          <PdfSection title="Note">
            <Text style={styles.note}>{notes}</Text>
          </PdfSection>
        ) : null}
      </BrandedPage>
    </Document>
  );
}
