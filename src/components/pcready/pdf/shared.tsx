import { Circle, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import { pdfFonts, pdfPalette } from "./theme";

export interface PdfStat {
  label: string;
  value: string | number;
  color: string;
  helper?: string;
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
    paddingTop: 92,
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
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: pdfPalette.surface,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 8,
    color: pdfPalette.ink,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: pdfPalette.accent,
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
    fontSize: 16,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 9,
    opacity: 0.86,
  },
  orgLine: {
    marginTop: 2,
    fontSize: 7,
    color: pdfPalette.muted,
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
    marginBottom: 14,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 58,
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
  statHelper: {
    marginTop: 3,
    color: pdfPalette.muted,
    fontSize: 7,
  },
  section: {
    marginTop: 10,
    marginBottom: 8,
    paddingTop: 8,
    borderTop: `1.5 solid ${pdfPalette.lineStrong}`,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionAccent: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: pdfPalette.accent,
    marginRight: 8,
  },
  sectionTitle: {
    fontFamily: pdfFonts.bold,
    fontSize: 11,
  },
  sectionMeta: {
    marginLeft: "auto",
    color: pdfPalette.muted,
    fontSize: 7,
  },
  chartGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  chartPanel: {
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: pdfPalette.paper,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 8,
    padding: 10,
  },
  chartTitle: {
    fontFamily: pdfFonts.bold,
    fontSize: 9,
    marginBottom: 8,
  },
  legend: {
    flexDirection: "row",
    gap: 9,
    marginTop: 7,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    fontSize: 7,
    color: pdfPalette.muted,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  verticalChart: {
    minHeight: 122,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    borderBottom: `1 solid ${pdfPalette.lineStrong}`,
    paddingBottom: 12,
  },
  monthGroup: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: "center",
  },
  monthBars: {
    height: 86,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  monthBar: {
    width: 8,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  axisLabel: {
    marginTop: 4,
    fontSize: 6,
    color: pdfPalette.muted,
  },
  horizontalRow: {
    marginBottom: 7,
  },
  horizontalLabel: {
    fontSize: 7,
    color: pdfPalette.muted,
    marginBottom: 2,
  },
  horizontalTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: pdfPalette.surface2,
    overflow: "hidden",
    flexDirection: "row",
  },
  horizontalBar: {
    height: 8,
  },
  donutWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  donutCenter: {
    position: "absolute",
    left: 34,
    top: 35,
    width: 32,
    textAlign: "center",
    fontFamily: pdfFonts.bold,
    fontSize: 12,
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
  footerStamp: {
    marginLeft: 10,
  },
  pageNumber: {
    marginLeft: "auto",
  },
});

export function BrandedPage({
  title,
  meta,
  children,
  organizationName,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
  organizationName?: string;
}) {
  const generatedAt = new Date().toLocaleString("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const org =
    organizationName || (globalThis as any).__APP_SETTINGS__?.organization_name || "PCReady";
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
          <Text style={styles.orgLine}>{org}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text>{generatedAt}</Text>
          <Text style={styles.metaChip}>{meta}</Text>
        </View>
      </View>
      {children}
      <View style={styles.footer} fixed>
        <Text>{org}</Text>
        <Text style={styles.footerStamp}>Export: {generatedAt}</Text>
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
          {stat.helper ? <Text style={styles.statHelper}>{stat.helper}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function PdfSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <View style={styles.section}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {children}
    </>
  );
}

export function ChartGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.chartGrid}>{children}</View>;
}

export function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.chartPanel} wrap={false}>
      <Text style={styles.chartTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function MonthlyBars({
  rows,
}: {
  rows: { label: string; opened: number; closed: number }[];
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.opened, row.closed]));
  return (
    <>
      <View style={styles.verticalChart}>
        {rows.map((row) => (
          <View key={row.label} style={styles.monthGroup}>
            <View style={styles.monthBars}>
              <View
                style={[
                  styles.monthBar,
                  { height: Math.max(3, (row.opened / max) * 86), backgroundColor: pdfPalette.accent },
                ]}
              />
              <View
                style={[
                  styles.monthBar,
                  { height: Math.max(3, (row.closed / max) * 86), backgroundColor: pdfPalette.success },
                ]}
              />
            </View>
            <Text style={styles.axisLabel}>{row.label}</Text>
          </View>
        ))}
      </View>
      <Legend
        items={[
          { label: "Aperti", color: pdfPalette.accent },
          { label: "Chiusi", color: pdfPalette.success },
        ]}
      />
    </>
  );
}

export function HorizontalBars({
  rows,
}: {
  rows: { label: string; assigned: number; completed: number }[];
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.assigned, row.completed]));
  return (
    <>
      {rows.slice(0, 8).map((row) => (
        <View key={row.label} style={styles.horizontalRow}>
          <Text style={styles.horizontalLabel}>
            {row.label}  {row.assigned}/{row.completed}
          </Text>
          <View style={styles.horizontalTrack}>
            <View
              style={[
                styles.horizontalBar,
                { width: `${(row.assigned / max) * 100}%`, backgroundColor: pdfPalette.accentSoft },
              ]}
            />
          </View>
          <View style={[styles.horizontalTrack, { marginTop: 2 }]}>
            <View
              style={[
                styles.horizontalBar,
                { width: `${(row.completed / max) * 100}%`, backgroundColor: pdfPalette.success },
              ]}
            />
          </View>
        </View>
      ))}
      <Legend
        items={[
          { label: "Assegnati", color: pdfPalette.accent },
          { label: "Completati", color: pdfPalette.success },
        ]}
      />
    </>
  );
}

export function DonutChart({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let angle = -90;

  return (
    <View style={styles.donutWrap}>
      <View style={{ width: 100, height: 100 }}>
        <Svg width={100} height={100} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={34} fill={pdfPalette.surface2} />
          {items.map((item) => {
            if (!total || item.value <= 0) return null;
            const sweep = (item.value / total) * 360;
            const path = donutSlicePath(50, 50, 34, 19, angle, angle + sweep);
            angle += sweep;
            return <Path key={item.label} d={path} fill={item.color} />;
          })}
          <Circle cx={50} cy={50} r={18} fill={pdfPalette.paper} />
        </Svg>
        <Text style={styles.donutCenter}>{total}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Legend items={items.map((item) => ({ label: `${item.label}: ${item.value}`, color: item.color }))} />
      </View>
    </View>
  );
}

function donutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text>{item.label}</Text>
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

  const textStyle: Style[] = [styles.cellText as Style];
  if (column.mono) textStyle.push(styles.mono as Style);
  if (column.color) {
    textStyle.push({ color: column.color(row), fontFamily: pdfFonts.bold } as Style);
  }

  return <Text style={textStyle}>{column.value(row)}</Text>;
}

function widthStyle(width: number | `${number}%`) {
  return typeof width === "number" ? { width } : { width };
}
