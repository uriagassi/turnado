import { describe, it, expect } from "vitest";
import { resolveLocale } from "../src/i18n/locale.js";

const allowList = { alice: "en", bob: "he" };
const supportedLocales = ["en", "he"];
const fallbackLocale = "en";

describe("resolveLocale", () => {
  it("maps a logged-in username to its configured locale", () => {
    expect(
      resolveLocale({ userName: "bob", queryLocale: undefined, allowList, supportedLocales, fallbackLocale })
    ).toBe("he");
  });

  it("lets a supported ?lang= query override the username's locale, for self-testing", () => {
    expect(
      resolveLocale({ userName: "bob", queryLocale: "en", allowList, supportedLocales, fallbackLocale })
    ).toBe("en");
  });

  it("ignores an unsupported query override and falls back to the username's locale", () => {
    expect(
      resolveLocale({ userName: "bob", queryLocale: "fr", allowList, supportedLocales, fallbackLocale })
    ).toBe("he");
  });

  it("falls back to the configured fallback locale for an unknown/unauthenticated user", () => {
    expect(
      resolveLocale({ userName: undefined, queryLocale: undefined, allowList, supportedLocales, fallbackLocale })
    ).toBe("en");
  });
});
