import { getRequest } from "@tanstack/react-start/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAppBaseUrl } from "@/lib/server-utils";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: vi.fn(),
}));

describe("getAppBaseUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return request origin when getRequest is available and returns a request", () => {
    const mockRequest = { url: "http://localhost:4000/portal?token=foo" };
    vi.mocked(getRequest).mockReturnValue(mockRequest as any);

    expect(getAppBaseUrl()).toBe("http://localhost:4000");
  });

  it("should fallback to environment variables when getRequest throws an error", () => {
    vi.mocked(getRequest).mockImplementation(() => {
      throw new Error("No StartEvent found");
    });

    const originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = "http://my-custom-env-url.com";

    try {
      expect(getAppBaseUrl()).toBe("http://my-custom-env-url.com");
    } finally {
      process.env.APP_URL = originalAppUrl;
    }
  });

  it("should fallback to localhost:3000 if no request is active and no env variables are set", () => {
    vi.mocked(getRequest).mockImplementation(() => {
      throw new Error("No StartEvent found");
    });

    const originalAppUrl = process.env.APP_URL;
    const originalViteAppUrl = process.env.VITE_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VITE_APP_URL;

    try {
      expect(getAppBaseUrl()).toBe("http://localhost:3000");
    } finally {
      if (originalAppUrl !== undefined) {
        process.env.APP_URL = originalAppUrl;
      }
      if (originalViteAppUrl !== undefined) {
        process.env.VITE_APP_URL = originalViteAppUrl;
      }
    }
  });
});
