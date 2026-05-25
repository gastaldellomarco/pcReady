# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Auth Flow E2E >> authenticated user is redirected away from /auth
- Location: e2e\auth-flow.spec.ts:16:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:8080/auth"
============================================================
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
  4  | test.describe("Auth Flow E2E", () => {
  5  |   test("login page renders correctly", async ({ page }) => {
  6  |     await setupE2EMocks(page, { seedSession: false });
  7  |     await page.goto("/auth");
  8  |     await page.waitForLoadState("networkidle");
  9  | 
  10 |     await expect(page.getByText("Accedi").first()).toBeVisible({ timeout: 10000 });
  11 |     await expect(page.getByPlaceholder(/tu@azienda|email/i)).toBeVisible();
  12 |     await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  13 |     await expect(page.getByRole("button", { name: /accedi/i })).toBeVisible();
  14 |   });
  15 | 
  16 |   test("authenticated user is redirected away from /auth", async ({ page }) => {
  17 |     // addInitScript seeds the session BEFORE any page JS runs,
  18 |     // so the auth page will detect the session on load and redirect.
  19 |     await setupE2EMocks(page, {
  20 |       seedSession: true,
  21 |       restOverrides: {
  22 |         "/profiles?": [
  23 |           { id: "00000000-0000-0000-0000-000000000001", full_name: "Admin User", initials: "AU" },
  24 |         ],
  25 |         "/user_profiles?": [
  26 |           { id: "00000000-0000-0000-0000-000000000001", display_name: "Admin User", avatar_url: null, password_set: true, language: "it" },
  27 |         ],
  28 |       },
  29 |     });
  30 | 
  31 |     await page.goto("/auth");
  32 |     // The app detects the session, loads the profile, and redirects to /dashboard.
  33 |     // Wait for the redirect to complete.
> 34 |     await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15000 });
     |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  35 |     const currentUrl = page.url();
  36 |     expect(currentUrl).not.toContain("/auth");
  37 |   });
  38 | });
  39 | 
```