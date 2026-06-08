import { Circle, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { pdfFonts, pdfPalette } from "./theme";
import type { Style } from "@react-pdf/stylesheet";

const A4_PORTRAIT_CONTENT_WIDTH = 539;
const CARD_LAYOUT_COLUMN_LIMIT = 5;
const DEFAULT_COMPANY_CONTACTS = "support@pcready.it | pcready.it";

/**
 *
 */
export type PdfTableLayout = "auto" | "table" | "cards";

/**
 *
 */
export interface PdfStat {
  label: string;
  value: string | number;
  color: string;
  helper?: string;
}

/**
 *
 */
export interface PdfColumn<T> {
  key: string;
  label: string;
  width: number | `${number}%`;
  mono?: boolean;
  color?: (row: T) => string | undefined;
  badge?: (row: T) => { label: string; color: string; backgroundColor: string } | null;
  value: (row: T) => string;
}

/**
 *
 */
export class PCReadyPDFTemplate {
  static readonly contentWidth = A4_PORTRAIT_CONTENT_WIDTH;
  static readonly columnLimit = CARD_LAYOUT_COLUMN_LIMIT;
  static readonly contacts = DEFAULT_COMPANY_CONTACTS;

  /**
   *
   */
  static shouldUseCardLayout(columns: PdfColumn<unknown>[]) {
    return (
      columns.length > PCReadyPDFTemplate.columnLimit ||
      numericColumnWidth(columns) > PCReadyPDFTemplate.contentWidth
    );
  }

  /**
   *
   */
  static cleanText(value: unknown) {
    return normalizePdfText(value);
  }
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 104,
    paddingRight: 28,
    paddingBottom: 48,
    paddingLeft: 28,
    fontFamily: pdfFonts.body,
    color: pdfPalette.ink,
    backgroundColor: pdfPalette.page,
    fontSize: 8,
  },
  header: {
    position: "absolute",
    top: 20,
    left: 28,
    right: 28,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: pdfPalette.surface,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 6,
    color: pdfPalette.ink,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 38,
    height: 38,
    marginLeft: 12,
  },
  brand: {
    fontFamily: pdfFonts.bold,
    fontSize: 15,
    color: pdfPalette.accent,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: pdfFonts.bold,
    color: pdfPalette.ink,
  },
  documentInfo: {
    marginTop: 3,
    fontSize: 8,
    color: pdfPalette.muted,
    lineHeight: 1.25,
    opacity: 0.86,
  },
  orgLine: {
    marginTop: 3,
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
    borderRadius: 10,
    backgroundColor: pdfPalette.accentSoft,
    color: pdfPalette.accent,
    fontFamily: pdfFonts.bold,
    fontSize: 7,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 104,
    minHeight: 58,
    backgroundColor: pdfPalette.surface,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 6,
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
    marginTop: 12,
    marginBottom: 10,
    paddingTop: 10,
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
    fontSize: 12,
    color: pdfPalette.accent,
  },
  sectionMeta: {
    marginLeft: "auto",
    color: pdfPalette.muted,
    fontSize: 7,
  },
  chartGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  chartPanel: {
    flexGrow: 1,
    flexBasis: 240,
    backgroundColor: pdfPalette.paper,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 6,
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
    borderRadius: 6,
  },
  row: {
    flexDirection: "row",
    minHeight: 30,
    borderBottom: `1 solid ${pdfPalette.line}`,
  },
  headerRow: {
    backgroundColor: pdfPalette.accent,
    color: "#FFFFFF",
    minHeight: 26,
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
    letterSpacing: 0,
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
  footerContacts: {
    marginLeft: 10,
  },
  pageNumber: {
    marginLeft: "auto",
  },
  cards: {
    gap: 10,
  },
  dataCard: {
    backgroundColor: pdfPalette.paper,
    border: `1 solid ${pdfPalette.line}`,
    borderRadius: 6,
    padding: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 8,
    borderBottom: `1 solid ${pdfPalette.line}`,
  },
  cardTitle: {
    fontFamily: pdfFonts.bold,
    color: pdfPalette.accent,
    fontSize: 10.5,
  },
  cardTitleSecondary: {
    marginLeft: "auto",
    color: pdfPalette.ink,
    fontSize: 9,
    maxWidth: 220,
    textAlign: "right",
  },
  cardFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardField: {
    width: "48%",
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 7,
    color: pdfPalette.muted,
    fontFamily: pdfFonts.bold,
    textTransform: "uppercase",
  },
  cardValue: {
    marginTop: 3,
    fontSize: 8.5,
    lineHeight: 1.3,
    color: pdfPalette.ink,
  },
});

/**
 *
 */
export function BrandedPage({
  title,
  meta,
  children,
  organizationName,
  contacts,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
  organizationName?: string;
  contacts?: string;
}) {
  const generatedAt = new Date().toLocaleString("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const org =
    organizationName || (globalThis as any).__APP_SETTINGS__?.organization_name || "PCReady";
  const companyContacts =
    contacts || (globalThis as any).__APP_SETTINGS__?.support_email || PCReadyPDFTemplate.contacts;
  return (
    <Page size="A4" orientation="portrait" style={styles.page}>
      <View style={styles.header} fixed>
        <View>
          <Text style={styles.brand}>PCReady</Text>
          <Text style={styles.subtitle}>{normalizePdfText(title)}</Text>
          <Text style={styles.documentInfo}>{normalizePdfText(meta)}</Text>
          <Text style={styles.orgLine}>{normalizePdfText(org)}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text>{generatedAt}</Text>
          <Text style={styles.metaChip}>A4 verticale</Text>
        </View>
        <Svg style={styles.logo} viewBox="0 0 48 48">
          <Rect
            x="5"
            y="8"
            width="38"
            height="27"
            rx="6"
            fill={pdfPalette.accentSoft}
            stroke={pdfPalette.accent}
            strokeWidth="3"
          />
          <Path
            d="M17 22.5 22.2 27.5 32 17"
            fill="none"
            stroke={pdfPalette.success}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M20 39h8M16 43h16"
            fill="none"
            stroke={pdfPalette.accent}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </Svg>
      </View>
      {children}
      <View style={styles.footer} fixed>
        <Text>{normalizePdfText(org)}</Text>
        <Text style={styles.footerContacts}>{normalizePdfText(companyContacts)}</Text>
        <Text style={styles.footerStamp}>Generato: {generatedAt}</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`}
        />
      </View>
    </Page>
  );
}

/**
 *
 */
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

/**
 *
 */
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

/**
 *
 */
export function ChartGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.chartGrid}>{children}</View>;
}

/**
 *
 */
export function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.chartPanel} wrap={false}>
      <Text style={styles.chartTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 *
 */
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
                  {
                    height: Math.max(3, (row.opened / max) * 86),
                    backgroundColor: pdfPalette.accent,
                  },
                ]}
              />
              <View
                style={[
                  styles.monthBar,
                  {
                    height: Math.max(3, (row.closed / max) * 86),
                    backgroundColor: pdfPalette.success,
                  },
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

/**
 *
 */
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
            {row.label} {row.assigned}/{row.completed}
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

/**
 *
 */
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
        <Legend
          items={items.map((item) => ({
            label: `${item.label}: ${item.value}`,
            color: item.color,
          }))}
        />
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

/**
 *
 */
export function PdfTable<T>({ rows, columns }: { rows: T[]; columns: PdfColumn<T>[] }) {
  return <AdaptivePdfTable rows={rows} columns={columns} />;
}

/**
 *
 */
export function AdaptivePdfTable<T>({
  rows,
  columns,
  layout = "auto",
}: {
  rows: T[];
  columns: PdfColumn<T>[];
  layout?: PdfTableLayout;
}) {
  const useCards =
    layout === "cards" ||
    (layout === "auto" && PCReadyPDFTemplate.shouldUseCardLayout(columns as PdfColumn<unknown>[]));

  if (useCards) {
    return <PdfCardList rows={rows} columns={columns} />;
  }

  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]} fixed>
        {columns.map((column, columnIndex) => (
          <View
            key={`${column.key}-${columnIndex}`}
            style={[styles.cell, widthStyle(column.width)]}
          >
            <Text style={styles.headCellText}>{column.label}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={`table-row-${index}`}
          style={[
            styles.row,
            { backgroundColor: index % 2 === 0 ? pdfPalette.paper : pdfPalette.surface },
          ]}
          wrap={false}
        >
          {columns.map((column, columnIndex) => (
            <View
              key={`${column.key}-${columnIndex}`}
              style={[styles.cell, widthStyle(column.width)]}
            >
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

  return <Text style={textStyle}>{normalizePdfText(column.value(row))}</Text>;
}

function PdfCardList<T>({ rows, columns }: { rows: T[]; columns: PdfColumn<T>[] }) {
  return (
    <View style={styles.cards}>
      {rows.map((row, index) => {
        const primary = columns[0];
        const secondary = columns[1];
        return (
          <View key={`card-${index}`} style={styles.dataCard} wrap={false}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>
                {primary ? normalizePdfText(primary.value(row)) : `Riga ${index + 1}`}
              </Text>
              {secondary ? (
                <Text style={styles.cardTitleSecondary}>
                  {normalizePdfText(secondary.value(row))}
                </Text>
              ) : null}
            </View>
            <View style={styles.cardFields}>
              {columns.slice(2).map((column, columnIndex) => (
                <View key={`${column.key}-${columnIndex}`} style={styles.cardField}>
                  <Text style={styles.cardLabel}>{normalizePdfText(column.label)}</Text>
                  <PdfCardValue row={row} column={column} />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PdfCardValue<T>({ row, column }: { row: T; column: PdfColumn<T> }) {
  const badge = column.badge?.(row);
  if (badge) {
    return (
      <Text
        style={[
          styles.badge,
          { color: badge.color, backgroundColor: badge.backgroundColor, marginTop: 3 },
        ]}
      >
        {normalizePdfText(badge.label)}
      </Text>
    );
  }

  const textStyle: Style[] = [styles.cardValue as Style];
  if (column.mono) textStyle.push(styles.mono as Style);
  if (column.color) {
    textStyle.push({ color: column.color(row), fontFamily: pdfFonts.bold } as Style);
  }

  return <Text style={textStyle}>{normalizePdfText(column.value(row))}</Text>;
}

function widthStyle(width: number | `${number}%`) {
  return typeof width === "number" ? { width } : { width };
}

function numericColumnWidth(columns: PdfColumn<unknown>[]) {
  return columns.reduce((sum, column) => {
    if (typeof column.width === "number") return sum + column.width;
    const pct = Number.parseFloat(column.width);
    return Number.isFinite(pct) ? sum + (pct / 100) * A4_PORTRAIT_CONTENT_WIDTH : sum;
  }, 0);
}

function normalizePdfText(value: unknown) {
  return String(value ?? "-")
    .replace(/\u00C2\u00B7/g, "|")
    .replace(/\u00C3\u00A0/g, "\u00E0")
    .replace(/\u00C3\u00A8/g, "\u00E8")
    .replace(/\u00C3\u00A9/g, "\u00E9")
    .replace(/\u00C3\u00AC/g, "\u00EC")
    .replace(/\u00C3\u00B2/g, "\u00F2")
    .replace(/\u00C3\u00B9/g, "\u00F9")
    .replace(/\u00E2\u20AC\u201C/g, "-")
    .replace(/\u00E2\u20AC\u201D/g, "-")
    .replace(/\u00E2\u20AC\u00A2/g, "-")
    .replace(/\u00EF\u00BC\u0161/g, ":")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
