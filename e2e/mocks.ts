import type { Page } from "@playwright/test";

const SUPABASE_URL = "http://localhost:54321";
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Mock Supabase Auth endpoints so the client can init and verify sessions.
 */
export async function mockSupabaseAuth(page: Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/settings`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { disable_signup: false, external: { email: true }, mailer_autoconfirm: true },
      }),
    });
  });

  await page.route(`${SUPABASE_URL}/auth/v1/user`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: MOCK_USER_ID,
        aud: "authenticated",
        role: "authenticated",
        email: "admin@test.it",
        email_confirmed_at: "2025-01-01T00:00:00Z",
        last_sign_in_at: "2025-01-01T00:00:00Z",
        app_metadata: { provider: "email" },
        user_metadata: {},
        identities: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        is_anonymous: false,
      }),
    });
  });

  await page.route(`${SUPABASE_URL}/auth/v1/token*`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: MOCK_USER_ID,
            aud: "authenticated",
            role: "authenticated",
            email: "admin@test.it",
            email_confirmed_at: "2025-01-01T00:00:00Z",
          },
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });

  await page.route(`${SUPABASE_URL}/auth/v1/logout`, async (route) => {
    await route.fulfill({ status: 204 });
  });
}

/**
 * Mock Supabase REST API endpoints.
 */
export async function mockSupabaseRest(page: Page, overrides?: Record<string, unknown>) {
  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (overrides) {
      for (const [pattern, data] of Object.entries(overrides)) {
        if (url.includes(pattern)) {
          const arr = Array.isArray(data) ? data : [data];
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "content-range": `0-${arr.length - 1}/${arr.length}` },
            body: JSON.stringify({ data: arr, error: null, count: arr.length }),
          });
          return;
        }
      }
    }

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/0" },
        body: JSON.stringify({ data: [], error: null, count: 0 }),
      });
    } else {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "00000000-0000-0000-0000-000000000099" }, error: null }),
      });
    }
  });
}

/**
 * Mock TanStack Start server functions (/_server). Catch-all returns null data.
 */
export async function mockServerFunctions(page: Page) {
  await page.route("**/_server*", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
  });
}

/**
 * Mock Supabase Realtime WebSocket connections.
 */
export async function mockRealtimeWebSocket(page: Page) {
  await page.routeWebSocket(`${SUPABASE_URL}/realtime/v1/**`, (ws) => {
    ws.onMessage((_msg) => {
      void _msg;
    });
  });
}

/**
 * Seed a mock Supabase session into sessionStorage.
 *
 * Uses addInitScript with string interpolation (JSON.stringify for safe escaping).
 * This runs BEFORE any page JavaScript, so the session is present when
 * the Supabase client initializes and calls getSession().
 *
 * Key format: sb-localhost-auth-token (supabase-js default: hostname.split('.')[0])
 * Also sets sb-localhost:54321-auth-token (belt-and-suspenders fallback).
 */
export async function seedMockSession(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  const sessionData = {
    currentSession: {
      access_token: "mock-access-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: "mock-refresh-token",
      user: {
        id: MOCK_USER_ID,
        aud: "authenticated",
        role: "authenticated",
        email: "admin@test.it",
        email_confirmed_at: "2025-01-01T00:00:00Z",
        last_sign_in_at: "2025-01-01T00:00:00Z",
        app_metadata: { provider: "email", full_name: "Admin User" },
        user_metadata: { full_name: "Admin User" },
        identities: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        is_anonymous: false,
      },
    },
    expiresAt,
  };

  // JSON.stringify on a string produces a properly escaped JS string literal.
  // e.g. JSON.stringify('{"a":1}') → '"{\\"a\\":1}"' — safe for use in JS code.
  const sessionJsonStr = JSON.stringify(JSON.stringify(sessionData));

  // Inject session into sessionStorage BEFORE any app code runs.
  // Using string concatenation (not function + args) because Playwright's
  // argument-passing for addInitScript is unreliable with complex objects.
  await page.addInitScript(`
    sessionStorage.setItem("sb-localhost-auth-token", ${sessionJsonStr});
    sessionStorage.setItem("sb-localhost:54321-auth-token", ${sessionJsonStr});
  `);
}

/**
 * Set up all E2E mocks for a test.
 */
export async function setupE2EMocks(
  page: Page,
  options?: {
    restOverrides?: Record<string, unknown>;
    seedSession?: boolean;
  },
) {
  await mockSupabaseAuth(page);
  await mockSupabaseRest(page, options?.restOverrides);
  await mockServerFunctions(page);
  await mockRealtimeWebSocket(page);

  if (options?.seedSession !== false) {
    await seedMockSession(page);
  }
}
