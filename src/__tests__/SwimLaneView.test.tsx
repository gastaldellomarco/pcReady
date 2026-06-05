// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TicketStatus, TicketPriority } from "@/lib/pcready";

// ── Mock di react-i18next ──────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === "string") return fallback;
      return key;
    },
  }),
}));

// ── Mock di SwimLaneRow e OverflowTable (figli) ─────────────────────────
vi.mock("@/components/kanban/SwimLaneRow", () => ({
  SwimLaneRow: vi.fn(() => (
    <tr data-testid="swimlane-row">
      <td colSpan={10}>row</td>
    </tr>
  )),
}));

vi.mock("@/components/ui/overflow-table", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="overflow-table">{children}</div>
  ),
}));

// ── Mock di @/lib/utils ────────────────────────────────────────────────
vi.mock("@/lib/utils", () => ({
  cn: (...args: (string | undefined | null | false)[]) => args.filter(Boolean).join(" "),
}));

import { axe } from "vitest-axe";
import { SwimLaneRow } from "@/components/kanban/SwimLaneRow";
// ── Import reale del componente dopo i mock ────────────────────────────
import { SwimLaneView, type SwimLaneCard } from "@/components/kanban/SwimLaneView";
import type { WipLimits } from "@/lib/app-settings";
import type { TechnicianOption } from "@/lib/technicians";

const STATUSES: TicketStatus[] = [
  "pending",
  "in-progress",
  "testing",
  "ready",
  "completed",
  "archived",
];

const MOCK_TECHNICIANS: TechnicianOption[] = [
  { id: "tech-1", full_name: "Mario Rossi", initials: "MR" },
  { id: "tech-2", full_name: "Luigi Bianchi", initials: "LB" },
];

const MOCK_CARDS: SwimLaneCard[] = [
  {
    id: "card-1",
    ticket_code: "PC-100",
    client: "Acme Inc.",
    status: "pending",
    priority: "high" as TicketPriority,
    assignee_id: "tech-1",
  },
  {
    id: "card-2",
    ticket_code: "PC-101",
    client: "Beta Ltd.",
    status: "in-progress",
    priority: "med" as TicketPriority,
    assignee_id: "tech-2",
  },
  {
    id: "card-3",
    ticket_code: "PC-102",
    client: "Gamma Spa",
    status: "pending",
    priority: "low" as TicketPriority,
    assignee_id: null,
  },
];

const DEFAULT_WIP: WipLimits = {
  pending: 10,
  "in-progress": 3,
  testing: 5,
  ready: 20,
  completed: 0,
  archived: 0,
};

function renderSwimLane(overrides: Partial<Parameters<typeof SwimLaneView>[0]> = {}) {
  const props = {
    cards: MOCK_CARDS,
    technicians: MOCK_TECHNICIANS,
    groupMode: "technician" as const,
    wipLimits: DEFAULT_WIP,
    statuses: STATUSES,
    visibleStatuses: STATUSES,
    collapsedColumns: new Set<TicketStatus>(),
    compactView: false,
    onToggleCollapseColumn: vi.fn(),
    canEdit: true,
    dragId: null,
    overCell: null,
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onDragOverCell: vi.fn(),
    onDragLeaveCell: vi.fn(),
    onMove: vi.fn(),
    cardViewers: new Map() as ReadonlyMap<string, import("@/hooks/useKanbanPresence").ViewerInfo[]>,
    setCurrentCard: vi.fn(),
    statusChangedAtMap: new Map() as ReadonlyMap<string, string>,
    ...overrides,
  };
  return { props, ...render(<SwimLaneView {...props} />) };
}

describe("SwimLaneView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Rendering colonne per ogni status ─────────────────────────
  it("renderizza una colonna per ogni status con conteggio ticket e WIP", () => {
    renderSwimLane();

    // Verifica che ogni status abbia la sua colonna visibile
    for (const status of STATUSES) {
      const header = screen.getByText(expectStatusLabel(status));
      expect(header).toBeTruthy();
    }

    // Verifica conteggio e WIP limit visibili
    expect(screen.getByText("2/10")).toBeTruthy(); // pending: 2 ticket, limit 10
    expect(screen.getByText("1/3")).toBeTruthy(); // in-progress: 1 ticket, limit 3
  });

  // ── Test 2: Colonne collassate ────────────────────────────────────────
  it("mostra solo pallino e abbreviazione per colonne collassate", () => {
    const collapsed = new Set<TicketStatus>(["completed"]);
    renderSwimLane({ collapsedColumns: collapsed });

    // pending è visibile con full header
    expect(screen.getByText(expectStatusLabel("pending"))).toBeTruthy();

    // completed NON dovrebbe avere il testo full header (solo abbreviazione)
    // Invece appare un bottone per espandere
    const expandButtons = screen.getAllByTitle(/Espandi/);
    expect(expandButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Test 3: Props propagate to SwimLaneRow ──────────────────────────
  it("passa le props di drag alle SwimLaneRow", () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const onMove = vi.fn();
    renderSwimLane({ onDragStart, onDragEnd, onMove });

    // Le row sono renderizzate (mock), verifico che siano presenti
    const rows = screen.getAllByTestId("swimlane-row");
    // 2 tecnici + 1 unassigned = 3 righe
    expect(rows.length).toBe(3);

    // Verifica che le props di drag siano state passate a ogni SwimLaneRow
    for (const call of vi.mocked(SwimLaneRow).mock.calls) {
      const props = call[0];
      expect(props.onDragStart).toBe(onDragStart);
      expect(props.onDragEnd).toBe(onDragEnd);
      expect(props.onMove).toBe(onMove);
    }
  });

  // ── Test 4: WIP over limit ────────────────────────────────────────────
  it("mostra conteggio rosso quando WIP supera il limite", () => {
    const wipLimits: WipLimits = { ...DEFAULT_WIP, pending: 1, "in-progress": 3 };
    renderSwimLane({ wipLimits });

    // pending ha 2 ticket con limite 1 → over limit
    const pendingText = screen.getByText("2/1");
    expect(pendingText).toBeTruthy();
    // Dovrebbe avere classi di over-limit
    expect(pendingText.className).toContain("danger");

    // in-progress ha 1 ticket con limite 3 → non over limit
    const ipText = screen.getByText("1/3");
    expect(ipText.className).not.toContain("danger");
  });

  // ── Test 5: Lane rendering (tecnici + unassigned) ─────────────────────
  it("renderizza una lane per ogni tecnico più una lane unassigned", () => {
    renderSwimLane();

    const rows = screen.getAllByTestId("swimlane-row");
    expect(rows.length).toBe(3); // 2 techs + unassigned
  });

  // ── Test 6: Compact view nasconde colonne non visibili ────────────────
  it("in compact view, nasconde le colonne non in visibleStatuses", () => {
    renderSwimLane({
      compactView: true,
      visibleStatuses: ["pending", "in-progress"],
    });

    // pending e in-progress visibili
    expect(screen.getByText(expectStatusLabel("pending"))).toBeTruthy();
    expect(screen.getByText(expectStatusLabel("in-progress"))).toBeTruthy();

    // testing, ready, completed, archived NON dovrebbero mostrare l'header completo
    // ma dovrebbero apparire come colonne collassate
    const expandButtons = screen.getAllByTitle(/Espandi/);
    expect(expandButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Test 7: Nessun tecnico ────────────────────────────────────────────
  it("mostra solo la lane unassigned quando non ci sono tecnici", () => {
    renderSwimLane({ technicians: [] });

    const rows = screen.getAllByTestId("swimlane-row");
    expect(rows.length).toBe(1); // solo unassigned
  });

  // ── Test 8: Accessibilità ────────────────────────────────────────────
  it("non ha violazioni a11y", async () => {
    const { container } = renderSwimLane();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

/** Helper: restituisce una regex che matcha l'header dello status */
function expectStatusLabel(status: TicketStatus): RegExp {
  const labels: Record<TicketStatus, string> = {
    pending: "In attesa",
    "in-progress": "In lavorazione",
    testing: "Testing",
    ready: "Pronto",
    completed: "Completato",
    archived: "Archiviato",
  };
  return new RegExp(labels[status], "i");
}
