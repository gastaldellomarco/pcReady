import { test, expect } from "@playwright/test";
import { setupE2EMocks } from "./mocks";

test.describe("Auth Flow E2E", () => {
  test("login page renders correctly", async ({ page }) => {
    await setupE2EMocks(page, { seedSession: false });
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Accedi").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/tu@azienda|email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /accedi/i })).toBeVisible();
  });

  test("authenticated user is redirected away from /auth", async ({ page }) => {
    // addInitScript seeds the session BEFORE any page JS runs,
    // so the auth page will detect the session on load and redirect.
    await setupE2EMocks(page, {
      seedSession: true,
      restOverrides: {
        "/profiles?": [
          { id: "00000000-0000-0000-0000-000000000001", full_name: "Admin User", initials: "AU" },
        ],
        "/user_profiles?": [
          {
            id: "00000000-0000-0000-0000-000000000001",
            display_name: "Admin User",
            avatar_url: null,
            password_set: true,
            language: "it",
          },
        ],
      },
    });

    await page.goto("/auth");
    // The app detects the session, loads the profile, and redirects to /dashboard.
    // Wait for the redirect to complete.
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15000 });
    const currentUrl = page.url();
    expect(currentUrl).not.toContain("/auth");
  });
});
