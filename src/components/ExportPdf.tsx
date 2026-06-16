import { AlertTriangle, FileDown, Loader2 } from "lucide-react";
import { useState, useCallback, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EXPORT_WARNING_THRESHOLD } from "@/lib/queries/list-config";
import type { DocumentProps } from "@react-pdf/renderer";

/**
 *
 */
export type ExportMode = "page" | "all";

/**
 *
 */
export interface ExportPdfProps<TData, TPdfRow> {
  // ── Visibility ──
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // ── Identity ──
  entityLabel: string;

  // ── PDF rendering (entity-specific) ──
  renderPdf: (rows: TPdfRow[], orgName?: string) => Promise<ReactElement<DocumentProps>>;
  mapRow: (row: TData) => TPdfRow;
  fileName: string;

  // ── Data fetching ──
  fetchAll: (filters: Record<string, any>) => Promise<{ data: TData[]; count: number }>;

  // ── Page context ──
  currentPageRows: TData[];
  activeFilters: Record<string, any>;
  totalFilteredCount: number;

  // ── Filter display ──
  /** Optional custom filter labels. Falls back to generic buildFilterSummary(). */
  filterSummary?: string[];

  // ── Callbacks ──
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/** Build a human-readable summary of active filters. */
function buildFilterSummary(
  filters: Record<string, any>,
  entityLabel: string,
  t: (key: string, fallback: string, options?: Record<string, any>) => string,
): string[] {
  const lines: string[] = [];
  if (filters.status) lines.push(`${t("exportPdf.filterStatus", "Status")}: ${filters.status}`);
  if (filters.priority) lines.push(`${t("exportPdf.filterPriority", "Priority")}: ${filters.priority}`);
  if (filters.ticket_type) lines.push(`${t("exportPdf.filterType", "Type")}: ${filters.ticket_type}`);
  if (filters.client_id) lines.push(t("exportPdf.filterClientFiltered", "Client: filtered"));
  if (filters.assignee_id) lines.push(t("exportPdf.filterAssigneeFiltered", "Assignee: filtered"));
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom || "...";
    const to = filters.dateTo || "...";
    lines.push(`${t("exportPdf.filterDate", "Date")}: ${from} – ${to}`);
  }
  if (filters.q) lines.push(`${t("exportPdf.filterSearch", "Search")}: "${filters.q}"`);
  return lines.length
    ? lines
    : [t("exportPdf.noActiveFilters", "No active filters for {{label}}", { label: entityLabel })];
}

/**
 *
 */
export function ExportPdf<TData, TPdfRow>({
  open,
  onOpenChange,
  entityLabel,
  renderPdf,
  mapRow,
  fileName,
  fetchAll,
  currentPageRows,
  activeFilters,
  totalFilteredCount,
  filterSummary,
  onSuccess,
  onError,
}: ExportPdfProps<TData, TPdfRow>) {
  const { t } = useTranslation("common");
  const [exportMode, setExportMode] = useState<ExportMode>("page");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageCount = currentPageRows.length;
  const allCount = totalFilteredCount;
  const showWarning = exportMode === "all" && allCount > EXPORT_WARNING_THRESHOLD;
  const isEmpty = allCount === 0;

  const filterLines = filterSummary ?? buildFilterSummary(activeFilters, entityLabel, t as (key: string, fallback: string, options?: Record<string, any>) => string);

  const handleExport = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const rows =
        exportMode === "page"
          ? currentPageRows.map(mapRow)
          : (await fetchAll(activeFilters)).data.map(mapRow);

      const { downloadPdf } = await import("@/components/pcready/pdf/export");
      const org = (globalThis as any).__APP_SETTINGS__?.organization_name || undefined;

      const pdfElement = await renderPdf(rows, org);
      await downloadPdf(pdfElement, fileName);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("exportPdf.exportError", "Export error");
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setBusy(false);
    }
  }, [
    exportMode,
    currentPageRows,
    mapRow,
    fetchAll,
    activeFilters,
    renderPdf,
    fileName,
    onOpenChange,
    onSuccess,
    onError,
  ]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Reset state on close
      setError(null);
      setExportMode("page");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="size-4" />
            {t("exportPdf.exportPdfTitle", "Export PDF")} — {entityLabel}
          </DialogTitle>
        </DialogHeader>

        {/* ── Active filters summary ── */}
        <div
          className="rounded-lg border px-3 py-2.5 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text3">
            {t("exportPdf.activeFilters", "Active filters")}
          </div>
          {filterLines.map((line) => (
            <div key={line} className="text-text2 leading-relaxed">
              {line}
            </div>
          ))}
        </div>

        {/* ── Export mode selection ── */}
        <fieldset className="space-y-2" disabled={busy}>
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
              exportMode === "page" ? "border-accent bg-accent/5" : "hover:bg-surface2"
            }`}
            style={{ borderColor: exportMode === "page" ? "var(--accent)" : "var(--border)" }}
          >
            <input
              type="radio"
              name="exportMode"
              className="size-3.5 accent-accent"
              checked={exportMode === "page"}
              onChange={() => setExportMode("page")}
            />
            <span className="text-sm text-text2">
              {t("exportPdf.currentPage", "Current page")}{" "}
              <span className="font-mono text-xs text-text3">
                ({pageCount} {entityLabel})
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
              exportMode === "all"
                ? "border-accent bg-accent/5"
                : isEmpty
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-surface2"
            }`}
            style={{ borderColor: exportMode === "all" ? "var(--accent)" : "var(--border)" }}
          >
            <input
              type="radio"
              name="exportMode"
              className="size-3.5 accent-accent"
              checked={exportMode === "all"}
              disabled={isEmpty}
              onChange={() => setExportMode("all")}
            />
            <span className="text-sm text-text2">
              {isEmpty ? (
                t("exportPdf.noResults", "No results")
              ) : (
                <>
                  {t("exportPdf.allFilteredResults", "All filtered results")}{" "}
                  <span className="font-mono text-xs text-text3">
                    ({allCount} {entityLabel})
                  </span>
                </>
              )}
            </span>
          </label>
        </fieldset>

        {/* ── Warning for large exports ── */}
        {showWarning && (
          <div
            className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs"
            style={{
              borderColor: "var(--badge-warning-border, #f59e0b33)",
              background: "var(--badge-warning-bg, #fef3c7)",
              color: "var(--badge-warning-fg, #92400e)",
            }}
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {t(
                "exportPdf.largeExportWarning",
                "Export exceeds {{threshold}} records ({{count}} {{entity}}). The PDF may be large.",
                {
                  threshold: EXPORT_WARNING_THRESHOLD,
                  count: allCount,
                  entity: entityLabel,
                },
              )}
            </span>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div
            className="rounded-lg border px-3 py-2.5 text-xs"
            style={{
              borderColor: "var(--badge-danger-border, #ef444433)",
              background: "var(--badge-danger-bg, #fee2e2)",
              color: "var(--badge-danger-fg, #991b1b)",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            {t("exportPdf.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-primary pc-btn-sm inline-flex items-center gap-1.5"
            disabled={busy || (exportMode === "all" && isEmpty)}
            onClick={handleExport}
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("exportPdf.exporting", "Exporting...")}
              </>
            ) : showWarning ? (
              <>
                <FileDown className="size-3.5" />
                {t("exportPdf.confirmExport", "Confirm and export")}
              </>
            ) : (
              <>
                <FileDown className="size-3.5" />
                {t("exportPdf.exportPdf", "Export PDF")}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
