import { describe, it, expect } from "vitest";
import { translate } from "../src/i18n/translate.js";

describe("translate", () => {
  it("looks up a known key in the requested locale", () => {
    expect(translate("en", "common.today")).toBe("Today");
    expect(translate("he", "common.today")).toBe("היום");
  });

  it("interpolates {{var}} placeholders from the given params", () => {
    expect(translate("en", "task.due.target", { date: "2026-08-23" })).toBe("Due: 2026-08-23");
    expect(translate("he", "task.due.target", { date: "2026-08-23" })).toBe("יעד: 2026-08-23");
  });

  it("falls back to English for an unsupported locale, and to the bare key for an unknown key", () => {
    expect(translate("fr", "common.today")).toBe("Today");
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });
});
