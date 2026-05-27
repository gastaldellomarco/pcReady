// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import userEvent from "@testing-library/user-event";

// ── Mock @/components/ui/dialog ────────────────────────────────────────
// Radix Dialog uses portals; mock to render children inline when open=true
vi.mock("@/components/ui/dialog", () => {
  return {
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="dialog-content">{children}</div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-header">{children}</div>
    ),
    DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <h2 data-testid="dialog-title" className={className}>{children}</h2>
    ),
  };
});

// ── Mock @react-pdf/renderer ───────────────────────────────────────────
vi.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}));

// ── Mock dynamic import: @/components/pcready/pdf/export ──────────────
const mockDownloadPdf = vi.fn().mockResolvedValue(undefined);
vi.mock("@/components/pcready/pdf/export", () => ({
  downloadPdf: (...args: unknown[]) => mockDownloadPdf(...args),
  previewPdf: vi.fn(),
  renderPdf: vi.fn(),
}));

// ── Mock react-i18next ──────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      typeof fallback === "string" ? fallback : key,
  }),
}));

// ── Mock lucide-react (icons render as spans with data-testid) ──────────
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...(actual as Record<string, unknown>),
    FileDown: (props: Record<string, unknown>) => <span data-testid="icon-filedown" {...props} />,
    Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
    AlertTriangle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  };
});

// ── Mock sonner ────────────────────────────────────────────────────────
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Import after mocks ──────────────────────────────────────────────────
import { ExportPdf } from "@/components/ExportPdf";
import { axe } from "vitest-axe";

// ── Test helpers ────────────────────────────────────────────────────────
interface TestRow {
  id: number;
  name: string;
}

function makeProps(overrides: Partial<Parameters<typeof ExportPdf<TestRow, TestRow>>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    entityLabel: "ticket",
    renderPdf: vi.fn().mockResolvedValue({ type: "document" }),
    mapRow: (row: TestRow) => row,
    fileName: "test-report.pdf",
    fetchAll: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ],
      count: 2,
    }),
    currentPageRows: [{ id: 1, name: "A" }] as TestRow[],
    activeFilters: { status: "open" },
    totalFilteredCount: 25,
    onSuccess: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

function renderExportPdf(overrides = {}) {
  const props = makeProps(overrides);
  const result = render(<ExportPdf<TestRow, TestRow> {...props} />);
  return { ...result, props };
}

describe("ExportPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Renders dialog with filter summary and options ────────────
  it("mostra la finestra con i filtri attivi e le opzioni di export", () => {
    renderExportPdf({
      activeFilters: { status: "aperto", priority: "alta", q: "test" },
      totalFilteredCount: 42,
    });

    // Dialog is visible
    expect(screen.getByTestId("dialog")).toBeTruthy();

    // Title includes entity label
    expect(screen.getByTestId("dialog-title").textContent).toContain("ticket");

    // Filter summary section
    expect(screen.getByText("Filtri attivi")).toBeTruthy();

    // "Pagina corrente" radio with count
    expect(screen.getByText(/Pagina corrente/)).toBeTruthy();

    // "Tutti i risultati filtrati" radio with count
    expect(screen.getByText(/Tutti i risultati filtrati/)).toBeTruthy();

    // Export button
    expect(screen.getByText("Esporta PDF")).toBeTruthy();
  });

  // ── Test 2: Custom filterSummary overrides the generic one ────────────
  it("usa il filterSummary personalizzato quando fornito", () => {
    renderExportPdf({
      filterSummary: ["Periodo: 2025-01 - 2025-12", "Cliente: ACME Srl"],
      activeFilters: {},
    });

    expect(screen.getByText("Periodo: 2025-01 - 2025-12")).toBeTruthy();
    expect(screen.getByText("Cliente: ACME Srl")).toBeTruthy();
  });

  // ── Test 3: Warning threshold (count > 500) ──────────────────────────
  it("mostra il warning quando i risultati superano la soglia di 500", async () => {
    renderExportPdf({ totalFilteredCount: 1200 });

    // No warning initially (default mode is "page")
    expect(
      screen.queryByText(/L'export supera/),
    ).toBeNull();

    // Switch to "all" mode
    const allRadio = screen.getByLabelText(/Tutti i risultati filtrati/i);
    await userEvent.click(allRadio);

    // Warning should appear
    await waitFor(() => {
      expect(screen.getByText(/L'export supera/)).toBeTruthy();
    });

    // Button should show "Conferma ed esporta"
    expect(screen.getByText("Conferma ed esporta")).toBeTruthy();
  });

  // ── Test 4: Warning threshold NOT shown when count ≤ 500 ──────────────
  it("non mostra il warning quando count è sotto la soglia", async () => {
    renderExportPdf({ totalFilteredCount: 300 });

    const allRadio = screen.getByLabelText(/Tutti i risultati filtrati/i);
    await userEvent.click(allRadio);

    // No warning
    expect(
      screen.queryByText(/L'export supera/),
    ).toBeNull();

    // Normal button label
    expect(screen.getByText("Esporta PDF")).toBeTruthy();
  });

  // ── Test 5: Empty state ──────────────────────────────────────────────
  it("disabilita l'opzione 'tutti' e il pulsante export quando non ci sono risultati", () => {
    renderExportPdf({ totalFilteredCount: 0, currentPageRows: [] });

    // "Tutti" option shows "Nessun risultato"
    expect(screen.getByText("Nessun risultato")).toBeTruthy();

    // "Tutti" radio is disabled — use getAllByRole to get all radios, second one is "all"
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    const allRadio = radios[1];
    expect(allRadio.disabled).toBe(true);

    // Page radio should still be enabled
    expect(radios[0].disabled).toBe(false);

    // Export button is disabled (all mode + empty — button disabled when exportMode=all && isEmpty)
    // Note: default mode is "page" so the button is enabled; switching to "all" is needed to see it disabled.
    // But since "all" radio is disabled, the user can't switch. The page export button should still work.
    const exportBtn = screen.getByText("Esporta PDF").closest("button")!;
    expect(exportBtn.disabled).toBe(false);

    // The "all" label has cursor-not-allowed and opacity-50
    const emptyLabel = screen.getByText("Nessun risultato").closest("label")!;
    expect(emptyLabel.className).toContain("opacity-50");
  });

  // ── Test 6: Loading state ────────────────────────────────────────────
  it("mostra lo spinner e disabilita i controlli durante l'export", async () => {
    // Make fetchAll hang (never resolves)
    const fetchAll = vi.fn(() => new Promise<never>(() => {}));
    renderExportPdf({ fetchAll, totalFilteredCount: 100 });

    // Switch to "all" mode first
    const allRadio = screen.getByLabelText(/Tutti i risultati filtrati/i);
    await userEvent.click(allRadio);

    // Click export
    const exportBtn = screen.getByText("Esporta PDF").closest("button")!;
    await userEvent.click(exportBtn);

    // Should show loading text
    await waitFor(() => {
      expect(screen.getByText(/Esportazione in corso/)).toBeTruthy();
    });

    // Button should be disabled
    expect(exportBtn.disabled).toBe(true);

    // Radios should be disabled (fieldset disabled)
    const fieldset = document.querySelector("fieldset");
    expect(fieldset?.disabled).toBe(true);
  });

  // ── Test 7: Error handling ───────────────────────────────────────────
  it("mostra il messaggio di errore quando fetchAll fallisce", async () => {
    const onError = vi.fn();
    const fetchAll = vi.fn().mockRejectedValue(new Error("Errore di rete"));
    renderExportPdf({ fetchAll, onError, totalFilteredCount: 100 });

    // Switch to "all" mode
    const allRadio = screen.getByLabelText(/Tutti i risultati filtrati/i);
    await userEvent.click(allRadio);

    // Click export
    const exportBtn = screen.getByText("Esporta PDF").closest("button")!;
    await userEvent.click(exportBtn);

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText("Errore di rete")).toBeTruthy();
    });

    // onError should be called
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    // Button should be re-enabled
    await waitFor(() => {
      expect(exportBtn.disabled).toBe(false);
    });
  });

  // ── Test 8: Error handling with renderPdf failure ────────────────────
  it("mostra errore quando renderPdf lancia un'eccezione", async () => {
    const onError = vi.fn();
    const renderPdf = vi.fn().mockRejectedValue(new Error("PDF render fallito"));
    const fetchAll = vi.fn().mockResolvedValue({ data: [{ id: 1, name: "A" }], count: 1 });
    renderExportPdf({ renderPdf, fetchAll, onError, totalFilteredCount: 100 });

    // Switch to "all" mode
    const allRadio = screen.getByLabelText(/Tutti i risultati filtrati/i);
    await userEvent.click(allRadio);

    // Click export
    await userEvent.click(screen.getByText("Esporta PDF").closest("button")!);

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText("PDF render fallito")).toBeTruthy();
    });

    // onError should be called
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── Test 9: "Current page" export does NOT call fetchAll ─────────────
  it("esporta la pagina corrente senza chiamare fetchAll", async () => {
    const fetchAll = vi.fn();
    const renderPdf = vi.fn().mockResolvedValue({ type: "document" });
    const onSuccess = vi.fn();
    const mapRow = vi.fn((row: TestRow) => ({ ...row, mapped: true }));

    renderExportPdf({
      fetchAll,
      renderPdf,
      onSuccess,
      mapRow,
      currentPageRows: [{ id: 1, name: "Page1" }],
      totalFilteredCount: 100,
    });

    // Default mode is "page" — click export
    await userEvent.click(screen.getByText("Esporta PDF").closest("button")!);

    await waitFor(() => {
      // fetchAll should NOT have been called
      expect(fetchAll).not.toHaveBeenCalled();

      // mapRow should have been called for each page row
      expect(mapRow).toHaveBeenCalled();

      // renderPdf should have been called
      expect(renderPdf).toHaveBeenCalled();

      // downloadPdf should have been called
      expect(mockDownloadPdf).toHaveBeenCalled();

      // onSuccess should be called
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // ── Test 10: "Export all" calls fetchAll then renderPdf ──────────────
  it("esporta tutti i risultati chiamando fetchAll e renderPdf", async () => {
    const fetchAll = vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
        { id: 3, name: "C" },
      ],
      count: 3,
    });
    const renderPdf = vi.fn().mockResolvedValue({ type: "document" });
    const onSuccess = vi.fn();

    renderExportPdf({
      fetchAll,
      renderPdf,
      onSuccess,
      totalFilteredCount: 50,
    });

    // Switch to "all" mode
    const allRadio = screen.getByLabelText(/Tutti i risultati filtrati/i);
    await userEvent.click(allRadio);

    // Click export
    await userEvent.click(screen.getByText("Esporta PDF").closest("button")!);

    await waitFor(() => {
      // fetchAll should have been called with active filters
      expect(fetchAll).toHaveBeenCalledWith({ status: "open" });

      // renderPdf should have been called with mapped rows
      expect(renderPdf).toHaveBeenCalled();

      // downloadPdf should have been called
      expect(mockDownloadPdf).toHaveBeenCalled();

      // onSuccess should be called
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // ── Test 11: Export with warning threshold — confirm and export ──────
  it("esporta dopo conferma quando count supera 500", async () => {
    const fetchAll = vi.fn().mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({ id: i, name: `R${i}` })),
      count: 1200,
    });
    const renderPdf = vi.fn().mockResolvedValue({ type: "document" });
    const onSuccess = vi.fn();

    renderExportPdf({
      fetchAll,
      renderPdf,
      onSuccess,
      totalFilteredCount: 1200,
    });

    // Switch to "all" mode — warning should appear
    const allRadio = screen.getByLabelText(/Tutti i risultati filtrati/i);
    await userEvent.click(allRadio);

    // Confirm export
    await userEvent.click(screen.getByText("Conferma ed esporta").closest("button")!);

    await waitFor(() => {
      expect(fetchAll).toHaveBeenCalled();
      expect(renderPdf).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // ── Test 12: Modal closes and resets state ──────────────────────────
  it("resetta lo stato alla chiusura della modale", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ExportPdf<TestRow, TestRow>
        {...makeProps({ onOpenChange, open: true, totalFilteredCount: 100 })}
      />,
    );

    // Show error state first
    const allRadio = screen.getByLabelText(/Tutti i risultati filtrati/i);
    await userEvent.click(allRadio);

    // Close via cancel button
    const cancelBtn = screen.getByText("Annulla");
    await userEvent.click(cancelBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Reopen with fresh state
    rerender(
      <ExportPdf<TestRow, TestRow>
        {...makeProps({ onOpenChange, open: true, totalFilteredCount: 25 })}
      />,
    );

    // Should be back to "page" mode (default)
    const pageRadio = screen.getByLabelText(/Pagina corrente/i) as HTMLInputElement;
    expect(pageRadio.checked).toBe(true);
  });

  // ── Test 13: entityLabel pluralization in counts ──────────────────────
  it("mostra il conteggio corretto con l'etichetta entità", () => {
    renderExportPdf({
      entityLabel: "dispositivo",
      currentPageRows: [{ id: 1, name: "A" }, { id: 2, name: "B" }],
      totalFilteredCount: 15,
    });

    // Page count
    expect(screen.getByText(/\(2 dispositivo\)/)).toBeTruthy();
    // All count
    expect(screen.getByText(/\(15 dispositivo\)/)).toBeTruthy();
  });

  // ── Test 14: Generic buildFilterSummary fallback ────────────────────
  it("usa buildFilterSummary generico quando filterSummary non è fornito", () => {
    renderExportPdf({
      filterSummary: undefined,
      activeFilters: {
        status: "completato",
        dateFrom: "2025-01-01",
        dateTo: "2025-06-01",
      },
    });

    expect(screen.getByText(/Stato: completato/)).toBeTruthy();
    expect(screen.getByText(/Data: 2025-01-01 – 2025-06-01/)).toBeTruthy();
  });

  // ── Test 15: Fallback message when no active filters ──────────────────
  it("mostra messaggio di fallback quando non ci sono filtri attivi", () => {
    renderExportPdf({
      filterSummary: undefined,
      activeFilters: {},
      entityLabel: "costo",
    });

    expect(screen.getByText("Nessun filtro attivo per costo")).toBeTruthy();
  });

  // ── Test 16: Accessibilità ────────────────────────────────────────────
  it("non ha violazioni a11y", async () => {
    const { container } = renderExportPdf();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
