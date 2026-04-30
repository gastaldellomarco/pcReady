import { Page, StyleSheet, Text, View, type Style } from "@react-pdf/renderer";
import { pdfFonts, pdfPalette } from "./theme";

export interface PdfStat {
  label: string;
  value: string | number;
  color: string;
}

export interface PdfColumn<T> {
  key: string;
  label: string;
  width: number | `${number}%`;
  mono?: boolean;
  color?: (row: T) => string | undefined;
  badge?: (row: T) => { label: string; color: string; backgroundColor: string } | null;
  value: (row: T) => string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 82,
    paddingRight: 28,
    paddingBottom: 42,
    paddingLeft: 28,
    fontFamily: pdfFonts.body,
    color: pdfPalette.ink,
    backgroundColor: pdfPalette.page,
    fontSize: 8,
  },
  header: {
    position: "absolute",
    top: 18,
    left: 28,
    right: 28,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: pdfPalette.surface,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 8,
    color: pdfPalette.ink,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: pdfPalette.ink,
    marginRight: 10,
    padding: 5,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  logoCell: {
    width: 7,
    height: 7,
    border: `1.5 solid ${pdfPalette.paper}`,
    borderRadius: 1,
  },
  brand: {
    fontFamily: pdfFonts.bold,
    fontSize: 15,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 8,
    opacity: 0.86,
  },
  headerMeta: {
    marginLeft: "auto",
    alignItems: "flex-end",
    gap: 3,
    fontSize: 8,
    color: pdfPalette.muted,
  },
  metaChip: {
    marginTop: 2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: pdfPalette.accentSoft,
    color: pdfPalette.accent,
    fontFamily: pdfFonts.bold,
    fontSize: 7,
  },
  stats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 52,
    backgroundColor: pdfPalette.surface,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  statLabel: {
    color: pdfPalette.muted,
    fontSize: 7,
    textTransform: "uppercase",
  },
  statValue: {
    marginTop: 5,
    fontFamily: pdfFonts.bold,
    fontSize: 20,
  },
  table: {
    backgroundColor: pdfPalette.paper,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 8,
  },
  row: {
    flexDirection: "row",
    minHeight: 30,
    borderBottom: `1 solid ${pdfPalette.line}`,
  },
  headerRow: {
    backgroundColor: pdfPalette.surface2,
    color: pdfPalette.muted,
    minHeight: 24,
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 7,
    justifyContent: "center",
  },
  headCellText: {
    fontFamily: pdfFonts.bold,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cellText: {
    fontSize: 8,
    lineHeight: 1.25,
  },
  mono: {
    fontFamily: pdfFonts.mono,
    color: pdfPalette.muted,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 7,
    fontFamily: pdfFonts.bold,
    fontSize: 7.5,
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 18,
    flexDirection: "row",
    color: pdfPalette.muted,
    fontSize: 7,
    borderTop: `1 solid ${pdfPalette.line}`,
    paddingTop: 8,
  },
  pageNumber: {
    marginLeft: "auto",
  },
});

export function BrandedPage({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  const generatedAt = new Date().toLocaleString("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header} fixed>
        <View style={styles.logo}>
          <View style={styles.logoCell} />
          <View style={styles.logoCell} />
          <View style={styles.logoCell} />
          <View style={styles.logoCell} />
        </View>
        <View>
          <Text style={styles.brand}>PCReady</Text>
          <Text style={styles.subtitle}>{title}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text>{generatedAt}</Text>
          <Text style={styles.metaChip}>{meta}</Text>
        </View>
      </View>
      {children}
      <View style={styles.footer} fixed>
        <Text>PCReady - {title}</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`}
        />
      </View>
    </Page>
  );
}

export function StatStrip({ stats }: { stats: PdfStat[] }) {
  return (
    <View style={styles.stats}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.stat}>
          <Text style={styles.statLabel}>{stat.label}</Text>
          <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function PdfTable<T>({ rows, columns }: { rows: T[]; columns: PdfColumn<T>[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]} fixed>
        {columns.map((column) => (
          <View key={column.key} style={[styles.cell, widthStyle(column.width)]}>
            <Text style={styles.headCellText}>{column.label}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={index}
          style={[
            styles.row,
            { backgroundColor: index % 2 === 0 ? pdfPalette.paper : pdfPalette.surface },
          ]}
          wrap={false}
        >
          {columns.map((column) => (
            <View key={column.key} style={[styles.cell, widthStyle(column.width)]}>
              <PdfCell row={row} column={column} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function PdfCell<T>({ row, column }: { row: T; column: PdfColumn<T> }) {
  const badge = column.badge?.(row);
  if (badge) {
    return (
      <Text style={[styles.badge, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
        {badge.label}
      </Text>
    );
  }

  return (
    <Text
      style={[
        styles.cellText,
        column.mono ? styles.mono : undefined,
        column.color ? { color: column.color(row), fontFamily: pdfFonts.bold } : undefined,
      ]}
    >
      {column.value(row)}
    </Text>
  );
}

function widthStyle(width: number | `${number}%`): Style {
  return typeof width === "number" ? { width } : { width };
}
