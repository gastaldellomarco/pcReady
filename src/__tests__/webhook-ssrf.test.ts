import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webhookAction } from "@/lib/automation-runs.server";

describe("webhookAction SSRF protections", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // stub fetch
    // @ts-expect-error mock global fetch
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    // @ts-expect-error restore original fetch
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("blocks private IP addresses resolved from hostname", async () => {
    // mock dns.lookup via the 'dns' module promises.lookup
    vi.mock("dns", () => ({
      promises: {
        lookup: vi.fn().mockResolvedValue([{ address: "127.0.0.1", family: 4 }]),
      },
    }));

    const result = await webhookAction({ url: "http://example.local" }, {}, "test");
    expect(result.status).toBe("error");
    expect(String(result.error).toLowerCase()).toContain("ssrf");
  });

  it("allows public addresses and calls fetch", async () => {
    vi.mock("dns", () => ({
      promises: { lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) },
    }));
    // @ts-expect-error mocked fetch
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => "ok" });

    const result = await webhookAction({ url: "http://example.com", payload: "{}" }, { ticket_id: 1 }, "test");
    expect(result.status).toBe("success");
    // ensure fetch was called
    // @ts-expect-error mocked fetch
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
