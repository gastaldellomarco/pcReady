// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// ── Mock useServerFn ──────────────────────────────────────────────────
const serverFnMocks = vi.hoisted(() => ({
  createPortalTicket: vi.fn(),
  listPortalDevices: vi.fn().mockResolvedValue({ devices: [] }),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn((fn: unknown) => {
    if (fn === serverFnMocks.createPortalTicket) return serverFnMocks.createPortalTicket;
    if (fn === serverFnMocks.listPortalDevices) return serverFnMocks.listPortalDevices;
    return vi.fn();
  }),
}));

vi.mock("@/lib/portal-tickets", () => ({
  createPortalTicket: serverFnMocks.createPortalTicket,
  listPortalDevices: serverFnMocks.listPortalDevices,
}));

// ── Mock sonner ────────────────────────────────────────────────────────
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Mock lucide-react ──────────────────────────────────────────────────
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...(actual as Record<string, unknown>),
    Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  };
});

// ── Import after mocks ──────────────────────────────────────────────────
import { NewTicketForm } from "@/components/portal/NewTicketForm";

describe("NewTicketForm — Accessibilità", () => {
  it("non ha violazioni a11y nello stato iniziale", async () => {
    const { container } = render(<NewTicketForm token="test-token" categories={["Assistenza tecnica", "Hardware", "Software"]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
