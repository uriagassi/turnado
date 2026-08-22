import { describe, it, expect } from "vitest";
import { AllowList } from "../src/auth/AllowList.js";

describe("AllowList", () => {
  it("resolves an allow-listed user's locale and email", () => {
    const allowList = new AllowList({
      alice: { locale: "en", email: "alice@example.com" },
      bob: { locale: "he", email: "bob@example.com" },
    });

    expect(allowList.localeFor("alice")).toBe("en");
    expect(allowList.emailFor("alice")).toBe("alice@example.com");
    expect(allowList.localeFor("bob")).toBe("he");
    expect(allowList.emailFor("bob")).toBe("bob@example.com");
  });

  it("treats a user missing from the map as not allowed, with no locale or email", () => {
    const allowList = new AllowList({ alice: { locale: "en", email: "alice@example.com" } });

    expect(allowList.isAllowed("mallory")).toBe(false);
    expect(allowList.localeFor("mallory")).toBeUndefined();
    expect(allowList.emailFor("mallory")).toBeUndefined();
  });

  it("treats an allow-listed username as allowed", () => {
    const allowList = new AllowList({ alice: { locale: "en", email: "alice@example.com" } });

    expect(allowList.isAllowed("alice")).toBe(true);
  });
});
