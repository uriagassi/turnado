import { describe, it, expect } from "vitest";
import { pickCookieSecretDefault } from "../src/setup/cookieSecret.js";

describe("pickCookieSecretDefault", () => {
  it("keeps an already-set real secret instead of regenerating one", () => {
    expect(pickCookieSecretDefault("some-existing-secret", () => "unused")).toBe(
      "some-existing-secret"
    );
  });

  it("generates a fresh secret when none is set yet", () => {
    expect(pickCookieSecretDefault(undefined, () => "generated-secret")).toBe("generated-secret");
  });

  it("generates a fresh secret rather than proposing the REPLACE_ME placeholder back", () => {
    expect(pickCookieSecretDefault("REPLACE_ME", () => "generated-secret")).toBe(
      "generated-secret"
    );
  });

  it("defaults to a real random generator that produces a 64-char hex string", () => {
    const secret = pickCookieSecretDefault(undefined);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the default generator doesn't repeat itself across calls", () => {
    expect(pickCookieSecretDefault(undefined)).not.toBe(pickCookieSecretDefault(undefined));
  });
});
