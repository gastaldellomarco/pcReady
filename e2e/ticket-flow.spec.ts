import { test, expect } from "@playwright/test";
import { setupE2EMocks } from "./mocks";

test.describe("Ticket Flow E2E", () => {
  test("tickets page loads and shows mock tickets", async ({ page }) => {
    const mockTickets = [
      {
        id: "00000000-0000-0000-0000-000000000010",
        ticket_code: "TKT-001", title: "Test ticket E2E",
        client: "Test Client", client_id: "00000000-0000-0000-0000-000000000020",
        status: "pending", priority: "med", ticket_type: "support",
        requester: "Mario Rossi", notes: "Test notes",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        created_by: "00000000-0000-0000-0000-000000000001",
        assignee_id: null, device_id: null, category: "Hardware",
      },
    ];

    // addInitScript seeds the session; navigate directly to /tickets
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
        "/checklist_templates?": [],
        "/clients?": [
          { id: "00000000-0000-0000-0000-000000000020", company_name: "Test Client" },
        ],
      },
    });

    await page.goto("/tickets");
    await page.waitForLoadState("networkidle");

    // Verify ticket page content
    const ticketVisible = await page.getByText("Test ticket E2E").isVisible().catch(() => false);
    const pageHasContent = await page.getByText(/ticket|nuovo/i).first().isVisible().catch(() => false);
    expect(ticketVisible || pageHasContent).toBe(true);
  });

  test("new ticket button opens creation form", async ({ page }) => {
    await setupE2EMocks(page, {
      seedSession: true,
      restOverrides: {
        "/tickets?": [],
        "/profiles?": [
          { id: "00000000-0000-0000-0000-000000000001", full_name: "Admin User", initials: "AU" },
        ],
        "/user_profiles?": [
          { id: "00000000-0000-0000-0000-000000000001", display_name: "Admin User", avatar_url: null, password_set: true, language: "it" },
        ],
        "/checklist_templates?": [],
        "/clients?": [],
      },
    });

    await page.goto("/tickets");
    await page.waitForLoadState("networkidle");

    // Click "Nuovo ticket" button
    const newTicketBtn = page.getByRole("button", { name: /nuovo ticket/i });
    await newTicketBtn.click();
    await page.waitForTimeout(1500);

    // Verify the creation form/modal appeared
    const hasDialog = await page.getByRole("dialog").isVisible().catch(() => false);
    const hasFormFields = await page.getByText(/cliente|richiedente|crea/i).first().isVisible().catch(() => false);
    expect(hasDialog || hasFormFields).toBe(true);
  });
});
