// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import {
  MaintenanceScheduleRowActions,
  type MaintenanceScheduleRowActionsProps,
} from "@/components/inventory/MaintenanceScheduleRowActions";
import type { MaintenanceSchedule } from "@/lib/maintenance";

// ── Mock lucide-react icons (canonical pattern in this repo) ─────────────
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...(actual as Record<string, unknown>),
    CheckCircle2: (props: Record<string, unknown>) => (
      <span data-testid="check-circle-icon" {...props} />
    ),
    Trash2: (props: Record<string, unknown>) => <span data-testid="trash-icon" {...props} />,
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────

function createSchedule(overrides: Partial<MaintenanceSchedule> = {}): MaintenanceSchedule {
  const base: MaintenanceSchedule = {
    id: "sched-001",
    device_id: "dev-001",
    title: "Pulizia hardware",
    description: null,
    recurrence: "monthly",
    next_due_date: "2026-07-15",
    last_done_date: null,
    assigned_to: null,
    auto_create_ticket: false,
    ticket_template: null,
    created_at: "2026-06-01T00:00:00Z",
  };
  return { ...base, ...overrides };
}

/**
 * Minimal i18next TFunction stub: returns the provided fallback
 * string (when present) and interpolates any `{{key}}` placeholders
 * from the options object. Mirrors what callers rely on from the
 * real i18next runtime without pulling in the runtime itself.
 */
const tStub: TFunction = ((key: string, fallback?: unknown, options?: Record<string, unknown>) => {
  let str = typeof fallback === "string" ? fallback : key;
  if (typeof str === "string" && options) {
    for (const [k, v] of Object.entries(options)) {
      str = str.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return str;
}) as unknown as TFunction;

function renderActions(
  overrides: Partial<MaintenanceScheduleRowActionsProps> = {},
): {
  onMarkCompleted: ReturnType<typeof vi.fn>;
  onRequestDelete: ReturnType<typeof vi.fn>;
} {
  const onMarkCompleted = vi.fn();
  const onRequestDelete = vi.fn();
  const schedule = overrides.schedule ?? createSchedule();
  const props: MaintenanceScheduleRowActionsProps = {
    canEdit: false,
    isAdmin: false,
    completingId: null,
    schedule,
    t: tStub,
    onMarkCompleted,
    onRequestDelete,
    ...overrides,
  };
  render(<MaintenanceScheduleRowActions {...props} />);
  return { onMarkCompleted, onRequestDelete };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("MaintenanceScheduleRowActions", () => {
  describe("permission gates", () => {
    it("renders the '—' placeholder when neither canEdit nor isAdmin is granted", () => {
      const { container } = renderActions({ canEdit: false, isAdmin: false });

      // The component short-circuits to a single <span> — no action
      // buttons, no destructive styling, and crucially no internal
      // wrapper (the action container uses class 'flex items-center gap-1',
      // which the test container does NOT). We check that specific class
      // rather than `closest("div")` — the latter would match RTL's own
      // test-container wrapper.
      const placeholder = screen.getByText("—");
      expect(placeholder.tagName).toBe("SPAN");
      expect(container.querySelector(".flex.items-center.gap-1")).toBeNull();
      expect(screen.queryByRole("button", { name: /Segna completata/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /Elimina manutenzione/i })).toBeNull();
      expect(screen.queryByTestId("check-circle-icon")).toBeNull();
      expect(screen.queryByTestId("trash-icon")).toBeNull();
    });

    it("renders ONLY the mark-completed button when canEdit is true and isAdmin is false", () => {
      renderActions({ canEdit: true, isAdmin: false });

      const markButton = screen.getByRole("button", { name: /Segna completata/i });
      expect(markButton).toBeTruthy();
      expect(markButton.hasAttribute("disabled")).toBe(false);
      expect(screen.getByTestId("check-circle-icon")).toBeTruthy();

      // Destructive gate is OFF — no Trash2 button anywhere.
      expect(screen.queryByTestId("trash-icon")).toBeNull();
      expect(screen.queryByRole("button", { name: /Elimina manutenzione/i })).toBeNull();
    });

    it("renders ONLY the destructive trash button when isAdmin is true and canEdit is false", () => {
      const title = "Pulizia straordinaria";
      renderActions({
        canEdit: false,
        isAdmin: true,
        schedule: createSchedule({ title }),
      });

      const deleteButton = screen.getByRole("button", {
        name: `Elimina manutenzione ${title}`,
      });
      expect(deleteButton).toBeTruthy();
      expect(deleteButton.getAttribute("title")).toBe("Elimina manutenzione");
      expect(deleteButton.className).toContain("text-destructive");
      expect(screen.getByTestId("trash-icon")).toBeTruthy();

      // canEdit is OFF — no mark-completed button anywhere.
      expect(screen.queryByRole("button", { name: /Segna completata/i })).toBeNull();
      expect(screen.queryByTestId("check-circle-icon")).toBeNull();
    });

    it("renders BOTH buttons and is wrapped in the actions container when canEdit and isAdmin are both true", () => {
      renderActions({ canEdit: true, isAdmin: true });

      expect(screen.getByRole("button", { name: /Segna completata/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Elimina manutenzione/i })).toBeTruthy();
      expect(screen.getByTestId("check-circle-icon")).toBeTruthy();
      expect(screen.getByTestId("trash-icon")).toBeTruthy();

      // Both buttons should share a single row container so they stay
      // visually adjacent regardless of cell contents.
      const markButton = screen.getByRole("button", { name: /Segna completata/i });
      const deleteButton = screen.getByRole("button", { name: /Elimina manutenzione/i });
      const markWrapper = markButton.parentElement;
      expect(markWrapper?.tagName).toBe("DIV");
      expect(markWrapper?.className).toContain("flex");
      expect(markWrapper?.contains(deleteButton)).toBe(true);
    });
  });

  describe("busy (completing) state", () => {
    it("disables the mark-completed button and switches its label to 'Aggiornamento...' when completingId matches this row", () => {
      const schedule = createSchedule({ id: "sched-busy" });
      renderActions({
        canEdit: true,
        isAdmin: false,
        schedule,
        completingId: "sched-busy",
      });

      const markButton = screen.getByRole("button", { name: /Aggiornamento/i });
      expect(markButton.hasAttribute("disabled")).toBe(true);
      // The "Segna completata" i18n fallback string should NOT be present
      // while the row is busy — verify we transitioned to the busy label.
      expect(markButton.textContent).toContain("Aggiornamento");
      expect(screen.queryByRole("button", { name: "Segna completata" })).toBeNull();
    });

    it("keeps the mark-completed button enabled when completingId points at a different row", () => {
      const schedule = createSchedule({ id: "sched-me" });
      renderActions({
        canEdit: true,
        isAdmin: false,
        schedule,
        completingId: "sched-other",
      });

      const markButton = screen.getByRole("button", { name: /Segna completata/i });
      expect(markButton.hasAttribute("disabled")).toBe(false);
      expect(markButton.textContent).not.toContain("Aggiornamento");
    });
  });

  describe("click handlers", () => {
    it("calls onMarkCompleted with the schedule when the mark-completed button is clicked", () => {
      const schedule = createSchedule({ id: "sched-click-complete" });
      const { onMarkCompleted } = renderActions({
        canEdit: true,
        isAdmin: false,
        schedule,
      });

      fireEvent.click(screen.getByRole("button", { name: /Segna completata/i }));
      expect(onMarkCompleted).toHaveBeenCalledTimes(1);
      expect(onMarkCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sched-click-complete" }),
      );
    });

    it("calls onRequestDelete with the schedule when the trash button is clicked", () => {
      const schedule = createSchedule({ id: "sched-click-delete" });
      const { onRequestDelete } = renderActions({
        canEdit: false,
        isAdmin: true,
        schedule,
      });

      fireEvent.click(screen.getByRole("button", { name: /Elimina manutenzione/i }));
      expect(onRequestDelete).toHaveBeenCalledTimes(1);
      expect(onRequestDelete).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sched-click-delete" }),
      );
    });
  });
});
