import { describe, expect, it } from "vitest";
import {
  buildDenyConsentRedirect,
  invalidOAuthScopesAgainstAllowed,
} from "@/lib/oauth-consent";
import type { OAuthScope } from "@/lib/oauth-scopes";

describe("oauth-consent helpers", () => {
  it("buildDenyConsentRedirect appends error and optional state", () => {
    const url = buildDenyConsentRedirect({
      clientId: "c1",
      redirectUri: "http://localhost:3000/callback",
      state: "abc123",
    });
    expect(url.startsWith("http://localhost:3000/callback?")).toBe(true);
    expect(url).toContain("error=access_denied");
    expect(url).toContain("state=abc123");
  });

  it("buildDenyConsentRedirect omits state when absent", () => {
    const url = buildDenyConsentRedirect({
      clientId: "c1",
      redirectUri: "https://app.example/oauth",
    });
    expect(url).toContain("error=access_denied");
    expect(url).not.toContain("state=");
  });

  it("invalidOAuthScopesAgainstAllowed lists only unknown scopes", () => {
    const allowed: OAuthScope[] = ["openid", "profile"];
    const requested = ["openid", "pcready:admin", "profile"] as OAuthScope[];
    expect(invalidOAuthScopesAgainstAllowed(requested, allowed)).toEqual(["pcready:admin"]);
  });
});
