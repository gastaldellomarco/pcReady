# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: kanban-drag.spec.ts >> Kanban Drag & Drop >> kanban page shows columns with tickets
- Location: e2e\kanban-drag.spec.ts:5:3

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
  4  | test.describe("Kanban Drag & Drop", () => {
  5  |   test("kanban page shows columns with tickets", async ({ page }) => {
  6  |     const mockTickets = [
  7  |       {
  8  |         id: "00000000-0000-0000-0000-000000000010",
  9  |         ticket_code: "TKT-001", title: "Ticket in attesa",
  10 |         client: "Test Client", client_id: "00000000-0000-0000-0000-000000000020",
  11 |         status: "pending", priority: "med", ticket_type: "support",
  12 |         requester: "Mario Rossi",
  13 |         created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  14 |         created_by: "00000000-0000-0000-0000-000000000001",
  15 |       },
  16 |       {
  17 |         id: "00000000-0000-0000-0000-000000000011",
  18 |         ticket_code: "TKT-002", title: "Ticket in lavorazione",
  19 |         client: "Test Client", client_id: "00000000-0000-0000-0000-000000000020",
  20 |         status: "in-progress", priority: "high", ticket_type: "repair",
  21 |         requester: "Luigi Bianchi",
  22 |         assignee_id: "00000000-0000-0000-0000-000000000001",
  23 |         created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  24 |         created_by: "00000000-0000-0000-0000-000000000001",
  25 |       },
  26 |       {
  27 |         id: "00000000-0000-0000-0000-000000000012",
  28 |         ticket_code: "TKT-003", title: "Ticket completato",
  29 |         client: "Test Client", client_id: "00000000-0000-0000-0000-000000000020",
  30 |         status: "completed", priority: "low", ticket_type: "support",
  31 |         requester: "Anna Verdi",
  32 |         created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  33 |         created_by: "00000000-0000-0000-0000-000000000001",
  34 |       },
  35 |     ];
  36 | 
  37 |     // addInitScript seeds the session; navigate directly to /kanban
  38 |     await setupE2EMocks(page, {
  39 |       seedSession: true,
  40 |       restOverrides: {
  41 |         "/tickets?": mockTickets,
  42 |         "/profiles?": [
  43 |           { id: "00000000-0000-0000-0000-000000000001", full_name: "Admin User", initials: "AU" },
  44 |         ],
  45 |         "/user_profiles?": [
  46 |           { id: "00000000-0000-0000-0000-000000000001", display_name: "Admin User", avatar_url: null, password_set: true, language: "it" },
  47 |         ],
  48 |       },
  49 |     });
  50 | 
  51 |     await page.goto("/kanban");
  52 |     await page.waitForLoadState("networkidle");
  53 | 
  54 |     // Verify kanban content
  55 |     const t1 = await page.getByText("Ticket in attesa").isVisible().catch(() => false);
  56 |     const t2 = await page.getByText("Ticket in lavorazione").isVisible().catch(() => false);
  57 |     const t3 = await page.getByText("Ticket completato").isVisible().catch(() => false);
  58 |     const hasColumns = await page.getByText(/in attesa|lavorazione|completato/i).first().isVisible().catch(() => false);
  59 |     const hasCards = await page.locator("[draggable='true']").first().isVisible().catch(() => false);
  60 | 
> 61 |     expect(t1 || t2 || t3 || hasColumns || hasCards).toBe(true);
     |                                                      ^ Error: expect(received).toBe(expected) // Object.is equality
  62 |   });
  63 | });
  64 | 
```