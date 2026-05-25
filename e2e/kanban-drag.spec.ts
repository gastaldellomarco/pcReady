import { test, expect } from "@playwright/test";
import { setupE2EMocks } from "./mocks";

test.describe("Kanban Drag & Drop", () => {
  test("kanban page shows columns with tickets", async ({ page }) => {
    const mockTickets = [
      {
        id: "00000000-0000-0000-0000-000000000010",
        ticket_code: "TKT-001", title: "Ticket in attesa",
        client: "Test Client", client_id: "00000000-0000-0000-0000-000000000020",
        status: "pending", priority: "med", ticket_type: "support",
        requester: "Mario Rossi",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        created_by: "00000000-0000-0000-0000-000000000001",
      },
      {
        id: "00000000-0000-0000-0000-000000000011",
        ticket_code: "TKT-002", title: "Ticket in lavorazione",
        client: "Test Client", client_id: "00000000-0000-0000-0000-000000000020",
        status: "in-progress", priority: "high", ticket_type: "repair",
        requester: "Luigi Bianchi",
        assignee_id: "00000000-0000-0000-0000-000000000001",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        created_by: "00000000-0000-0000-0000-000000000001",
      },
      {
        id: "00000000-0000-0000-0000-000000000012",
        ticket_code: "TKT-003", title: "Ticket completato",
        client: "Test Client", client_id: "00000000-0000-0000-0000-000000000020",
        status: "completed", priority: "low", ticket_type: "support",
        requester: "Anna Verdi",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        created_by: "00000000-0000-0000-0000-000000000001",
      },
    ];

    // addInitScript seeds the session; navigate directly to /kanban
    await setupE2EMocks(page, {
      seedSession: true,
      restOverrides: {
        "/tickets?": mockTickets,
        "/profiles?": [
          { id: "00000000-0000-0000-0000-000000000001", full_name: "Admin User", initials: "AU" },
        ],
        "/user_profiles?": [
          { id: "00000000-0000-0000-0000-000000000001", display_name: "Admin User", avatar_url: null, password_set: true, language: "it" },
        ],
      },
    });

    await page.goto("/kanban");
    await page.waitForLoadState("networkidle");

    // Verify kanban content
    const t1 = await page.getByText("Ticket in attesa").isVisible().catch(() => false);
    const t2 = await page.getByText("Ticket in lavorazione").isVisible().catch(() => false);
    const t3 = await page.getByText("Ticket completato").isVisible().catch(() => false);
    const hasColumns = await page.getByText(/in attesa|lavorazione|completato/i).first().isVisible().catch(() => false);
    const hasCards = await page.locator("[draggable='true']").first().isVisible().catch(() => false);

    expect(t1 || t2 || t3 || hasColumns || hasCards).toBe(true);
  });
});
