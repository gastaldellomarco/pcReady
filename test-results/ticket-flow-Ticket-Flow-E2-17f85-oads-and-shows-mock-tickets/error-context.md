# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ticket-flow.spec.ts >> Ticket Flow E2E >> tickets page loads and shows mock tickets
- Location: e2e\ticket-flow.spec.ts:5:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic "pcReady" [ref=e5]:
        - img [ref=e6]
        - generic [ref=e10]: pcReady
      - generic [ref=e11]: v1.1.1
    - generic [ref=e12]:
      - generic [ref=e14]: Accedi
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Email
          - textbox "tu@azienda.it" [ref=e18]
        - generic [ref=e19]:
          - generic [ref=e20]: Password
          - textbox "Password" [ref=e21]
        - button "Accedi" [ref=e22] [cursor=pointer]
        - paragraph [ref=e23]: Gli account vengono creati solo dagli amministratori.
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { setupE2EMocks } from "./mocks";
  3  | 
  4  | test.describe("Ticket Flow E2E", () => {
  5  |   test("tickets page loads and shows mock tickets", async ({ page }) => {
  6  |     const mockTickets = [
  7  |       {
  8  |         id: "00000000-0000-0000-0000-000000000010",
  9  |         ticket_code: "TKT-001", title: "Test ticket E2E",
  10 |         client: "Test Client", client_id: "00000000-0000-0000-0000-000000000020",
  11 |         status: "pending", priority: "med", ticket_type: "support",
  12 |         requester: "Mario Rossi", notes: "Test notes",
  13 |         created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  14 |         created_by: "00000000-0000-0000-0000-000000000001",
  15 |         assignee_id: null, device_id: null, category: "Hardware",
  16 |       },
  17 |     ];
  18 | 
  19 |     // addInitScript seeds the session; navigate directly to /tickets
  20 |     await setupE2EMocks(page, {
  21 |       seedSession: true,
  22 |       restOverrides: {
  23 |         "/tickets?": mockTickets,
  24 |         "/profiles?": [
  25 |           { id: "00000000-0000-0000-0000-000000000001", full_name: "Admin User", initials: "AU" },
  26 |         ],
  27 |         "/user_profiles?": [
  28 |           { id: "00000000-0000-0000-0000-000000000001", display_name: "Admin User", avatar_url: null, password_set: true, language: "it" },
  29 |         ],
  30 |         "/checklist_templates?": [],
  31 |         "/clients?": [
  32 |           { id: "00000000-0000-0000-0000-000000000020", company_name: "Test Client" },
  33 |         ],
  34 |       },
  35 |     });
  36 | 
  37 |     await page.goto("/tickets");
  38 |     await page.waitForLoadState("networkidle");
  39 | 
  40 |     // Verify ticket page content
  41 |     const ticketVisible = await page.getByText("Test ticket E2E").isVisible().catch(() => false);
  42 |     const pageHasContent = await page.getByText(/ticket|nuovo/i).first().isVisible().catch(() => false);
> 43 |     expect(ticketVisible || pageHasContent).toBe(true);
     |                                             ^ Error: expect(received).toBe(expected) // Object.is equality
  44 |   });
  45 | 
  46 |   test("new ticket button opens creation form", async ({ page }) => {
  47 |     await setupE2EMocks(page, {
  48 |       seedSession: true,
  49 |       restOverrides: {
  50 |         "/tickets?": [],
  51 |         "/profiles?": [
  52 |           { id: "00000000-0000-0000-0000-000000000001", full_name: "Admin User", initials: "AU" },
  53 |         ],
  54 |         "/user_profiles?": [
  55 |           { id: "00000000-0000-0000-0000-000000000001", display_name: "Admin User", avatar_url: null, password_set: true, language: "it" },
  56 |         ],
  57 |         "/checklist_templates?": [],
  58 |         "/clients?": [],
  59 |       },
  60 |     });
  61 | 
  62 |     await page.goto("/tickets");
  63 |     await page.waitForLoadState("networkidle");
  64 | 
  65 |     // Click "Nuovo ticket" button
  66 |     const newTicketBtn = page.getByRole("button", { name: /nuovo ticket/i });
  67 |     await newTicketBtn.click();
  68 |     await page.waitForTimeout(1500);
  69 | 
  70 |     // Verify the creation form/modal appeared
  71 |     const hasDialog = await page.getByRole("dialog").isVisible().catch(() => false);
  72 |     const hasFormFields = await page.getByText(/cliente|richiedente|crea/i).first().isVisible().catch(() => false);
  73 |     expect(hasDialog || hasFormFields).toBe(true);
  74 |   });
  75 | });
  76 | 
```