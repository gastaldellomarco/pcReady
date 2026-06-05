import { fireEvent, render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WidgetAnnotationBadge } from "@/components/dashboard/WidgetAnnotationBadge";
import type { WidgetAnnotationRow } from "@/lib/widget-annotations";

// ── Mock lucide-react icons ─────────────────────────────────────────────
vi.mock("lucide-react", () => ({
  StickyNote: (props: Record<string, unknown>) => (
    <span data-testid="sticky-note-icon" {...props} />
  ),
  Trash2: (props: Record<string, unknown>) => <span data-testid="trash-icon" {...props} />,
  Pencil: (props: Record<string, unknown>) => <span data-testid="pencil-icon" {...props} />,
  Plus: (props: Record<string, unknown>) => <span data-testid="plus-icon" {...props} />,
}));

// ── Mock Popover (Radix) ────────────────────────────────────────────────
vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (o: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { asChild?: boolean; children: React.ReactNode }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

// ── Hoisted mocks for useAuth and useWidgetAnnotations ──────────────────
const mockAnnotations = vi.hoisted(() => [] as WidgetAnnotationRow[]);
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    session: { access_token: "mock-token" },
    user: { id: "user-001", email: "test@test.it" },
    profile: {
      id: "user-001",
      full_name: "Test User",
      initials: "TU",
      role: "admin",
      language: "it",
    },
    loading: false,
    profileLoading: false,
    authError: null,
    canEdit: true,
    isAdmin: true,
    refreshProfile: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useWidgetAnnotations", () => ({
  useWidgetAnnotations: () => ({
    annotations: mockAnnotations as unknown as WidgetAnnotationRow[],
    isLoading: false,
    create: mockCreate[0] as unknown as ReturnType<typeof vi.fn>,
    update: mockUpdate[0] as unknown as ReturnType<typeof vi.fn>,
    remove: mockRemove[0] as unknown as ReturnType<typeof vi.fn>,
    isPending: false,
  }),
}));

// ── Factory helpers ──────────────────────────────────────────────────────

function createAnnotationRow(overrides: Partial<WidgetAnnotationRow> = {}): WidgetAnnotationRow {
  return {
    id: "ann-001",
    user_id: "user-001",
    widget_id: "stat-cards",
    text: "Picco per aggiornamento Windows",
    note_date: "2026-05-28",
    created_at: "2026-05-28T10:00:00Z",
    updated_at: "2026-05-28T10:00:00Z",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("WidgetAnnotationBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnnotations.length = 0;
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the sticky note icon button", () => {
      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      expect(screen.getByTestId("sticky-note-icon")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Apri note widget" })).toBeTruthy();
    });

    it("renders with the correct widgetId", () => {
      render(<WidgetAnnotationBadge widgetId="analytics-card" />);

      // Component renders, smoke test passes
      expect(screen.getByTestId("sticky-note-icon")).toBeTruthy();
    });

    it("applies group-hover opacity classes for desktop visibility", () => {
      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      const button = screen.getByRole("button", { name: "Apri note widget" });
      expect(button.className).toContain("opacity-0");
      expect(button.className).toContain("group-hover:opacity-100");
    });
  });

  // ── Empty state ────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows no count indicator when there are no annotations", () => {
      mockAnnotations.length = 0;

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      // The dot indicator is only rendered when count > 0
      // No dot badge should be visible
      const button = screen.getByRole("button", { name: "Apri note widget" });
      const dotElements = button.querySelectorAll(".rounded-full");
      expect(dotElements.length).toBe(0);
    });

    it("shows empty state message in popover when opened", async () => {
      mockAnnotations.length = 0;

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      // Open the popover
      const button = screen.getByRole("button", { name: "Apri note widget" });
      fireEvent.click(button);

      // Default popover mock doesn't control open/close, so content should render
      // Check for the empty message
      expect(screen.getByText("Nessuna nota per questo widget.")).toBeTruthy();
    });
  });

  // ── With annotations ───────────────────────────────────────────────────

  describe("with annotations", () => {
    it("shows annotation text in the popover", () => {
      (mockAnnotations as WidgetAnnotationRow[]).push(
        createAnnotationRow({ text: "Prima nota di test" }),
      );

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      // Open the popover
      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      expect(screen.getByText("Prima nota di test")).toBeTruthy();
    });

    it("shows date badge when annotation has a date", () => {
      (mockAnnotations as WidgetAnnotationRow[]).push(
        createAnnotationRow({ note_date: "2026-05-28" }),
      );

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      // fmtDate("2026-05-28") → "28 mag" (Italian locale short format)
      expect(screen.getByText("28 mag")).toBeTruthy();
    });

    it("shows edit and delete icons for each annotation", () => {
      (mockAnnotations as WidgetAnnotationRow[]).push(createAnnotationRow());

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      expect(screen.getByTestId("pencil-icon")).toBeTruthy();
      expect(screen.getByTestId("trash-icon")).toBeTruthy();
    });

    it("shows annotation count in the popover header", () => {
      (mockAnnotations as WidgetAnnotationRow[]).push(
        createAnnotationRow({ id: "a1" }),
        createAnnotationRow({ id: "a2" }),
      );

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      expect(screen.getByText("2")).toBeTruthy();
    });

    it("renders multiple annotations", () => {
      (mockAnnotations as WidgetAnnotationRow[]).push(
        createAnnotationRow({ id: "a1", text: "Nota 1" }),
        createAnnotationRow({ id: "a2", text: "Nota 2", widget_id: "other" }),
        createAnnotationRow({ id: "a3", text: "Nota 3" }),
      );

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      expect(screen.getByText("Nota 1")).toBeTruthy();
      expect(screen.getByText("Nota 2")).toBeTruthy();
      expect(screen.getByText("Nota 3")).toBeTruthy();
    });
  });

  // ── Add annotation form ────────────────────────────────────────────────

  describe("add annotation form", () => {
    it("renders a textarea and date input for adding new notes", () => {
      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      expect(screen.getByPlaceholderText("Aggiungi una nota...")).toBeTruthy();
      expect(screen.getByText("Aggiungi")).toBeTruthy();
    });

    it("calls create with the entered text and date", () => {
      const createFn = vi.fn();
      mockCreate[0] = createFn;

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      const textarea = screen.getByPlaceholderText("Aggiungi una nota...");
      fireEvent.change(textarea, { target: { value: "Nuova nota di test" } });

      fireEvent.click(screen.getByText("Aggiungi"));

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({
          widget_id: "stat-cards",
          text: "Nuova nota di test",
        }),
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      );
    });

    it("disables the add button when text is empty", () => {
      const createFn = vi.fn();
      mockCreate[0] = createFn;

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      const addButton = screen.getByText("Aggiungi");
      expect((addButton as HTMLButtonElement).disabled).toBe(true);
    });

    it("enables the add button when text is entered", () => {
      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      const textarea = screen.getByPlaceholderText("Aggiungi una nota...");
      fireEvent.change(textarea, { target: { value: "Test" } });

      const addButton = screen.getByText("Aggiungi");
      expect((addButton as HTMLButtonElement).disabled).toBe(false);
    });

    it("submits on Enter without shift", () => {
      const createFn = vi.fn();
      mockCreate[0] = createFn;

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      const textarea = screen.getByPlaceholderText("Aggiungi una nota...");
      fireEvent.change(textarea, { target: { value: "Test invio" } });
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Test invio" }),
        expect.any(Object),
      );
    });

    it("does not submit on Shift+Enter", () => {
      const createFn = vi.fn();
      mockCreate[0] = createFn;

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      const textarea = screen.getByPlaceholderText("Aggiungi una nota...");
      fireEvent.change(textarea, { target: { value: "Test shift enter" } });
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

      expect(createFn).not.toHaveBeenCalled();
    });
  });

  // ── Delete annotation ──────────────────────────────────────────────────

  describe("delete annotation", () => {
    it("calls remove with the annotation ID", () => {
      const removeFn = vi.fn();
      mockRemove[0] = removeFn;
      mockCreate[0] = vi.fn();
      (mockAnnotations as WidgetAnnotationRow[]).push(createAnnotationRow({ id: "ann-to-delete" }));

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      const deleteButton = screen.getByTitle("Elimina");
      fireEvent.click(deleteButton);

      expect(removeFn).toHaveBeenCalledWith("ann-to-delete");
    });
  });

  // ── Edit annotation ────────────────────────────────────────────────────

  describe("edit annotation", () => {
    it("enters edit mode when pencil icon is clicked", () => {
      mockCreate[0] = vi.fn();
      (mockAnnotations as WidgetAnnotationRow[]).push(
        createAnnotationRow({ id: "ann-edit", text: "Testo originale" }),
      );

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      const editButton = screen.getByTitle("Modifica");
      fireEvent.click(editButton);

      // After entering edit mode, a textarea with the original text should appear
      const textareas = screen.getAllByRole("textbox");
      const editTextarea = textareas.find(
        (ta) => (ta as HTMLTextAreaElement).value === "Testo originale",
      );
      expect(editTextarea).toBeTruthy();
    });

    it("calls update when save is clicked in edit mode", () => {
      const updateFn = vi.fn();
      mockUpdate[0] = updateFn;
      mockCreate[0] = vi.fn();
      (mockAnnotations as WidgetAnnotationRow[]).push(
        createAnnotationRow({ id: "ann-edit", text: "Vecchio testo" }),
      );

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      // Enter edit mode
      fireEvent.click(screen.getByTitle("Modifica"));

      // Change text
      const textareas = screen.getAllByRole("textbox");
      const editTextarea = textareas.find(
        (ta) => (ta as HTMLTextAreaElement).value === "Vecchio testo",
      )!;
      fireEvent.change(editTextarea, { target: { value: "Testo modificato" } });

      // Save
      fireEvent.click(screen.getByText("Salva"));

      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          annotationId: "ann-edit",
          updates: expect.objectContaining({ text: "Testo modificato" }),
        }),
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      );
    });

    it("cancels edit mode without saving", () => {
      mockCreate[0] = vi.fn();
      (mockAnnotations as WidgetAnnotationRow[]).push(
        createAnnotationRow({ id: "ann-edit", text: "Testo originale" }),
      );

      render(<WidgetAnnotationBadge widgetId="stat-cards" />);

      fireEvent.click(screen.getByRole("button", { name: "Apri note widget" }));

      // Enter edit mode
      fireEvent.click(screen.getByTitle("Modifica"));

      // Cancel
      fireEvent.click(screen.getByText("Annulla"));

      // Original text should still be visible
      expect(screen.getByText("Testo originale")).toBeTruthy();
    });
  });
});
