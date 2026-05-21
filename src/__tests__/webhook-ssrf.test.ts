import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { dnsLookupMock } = vi.hoisted(() => ({
  dnsLookupMock: vi.fn(),
}));

vi.mock("dns", () => ({
  promises: {
    lookup: dnsLookupMock,
  },
}));

import { webhookAction } from "@/lib/automation-runs.server";

describe("webhookAction SSRF protections", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dnsLookupMock.mockReset();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("blocks private IP addresses resolved from hostname", async () => {
    dnsLookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    const result = await webhookAction({ url: "http://example.local" }, {}, "test");
    expect(result.status).toBe("error");
    expect(String(result.error).toLowerCase()).toContain("ssrf");
  });

  it("allows public addresses and calls fetch", async () => {
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "ok" });

    const result = await webhookAction(
      { url: "http://example.com", payload: "{}" },
      { ticket_id: 1 },
      "test",
    );
    expect(result.status).toBe("success");
    expect(fetchMock).toHaveBeenCalled();
  });
});
