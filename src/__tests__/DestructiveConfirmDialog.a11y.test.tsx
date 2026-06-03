// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";

// ── Mock react-i18next ──────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      typeof fallback === "string" ? fallback : key,
  }),
}));

// ── Mock lucide-react (used by alert-dialog internally via icons) ───────
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...(actual as Record<string, unknown>),
    X: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  };
});

// ── Mock sonner (not used in this component, but may be tree-shaken in) ──
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ── Import after mocks ──────────────────────────────────────────────────
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";

describe("DestructiveConfirmDialog a11y", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("non ha violazioni a11y quando aperto", async () => {
    const { baseElement } = render(
      <DestructiveConfirmDialog
        open={true}
        title="Elimina script"
        description="Sei sicuro di voler eliminare questo script?"
        confirmLabel="Elimina"
        loadingLabel="Eliminazione..."
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    // Radix AlertDialog porta il contenuto in document.body,
    // quindi usiamo baseElement (document.body) per l'analisi axe
    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();
  });
});
