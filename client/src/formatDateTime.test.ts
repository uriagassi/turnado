import { describe, it, expect } from "vitest";
import { formatDateTime } from "./formatDateTime";

describe("formatDateTime", () => {
  it("formats an ISO datetime as a locale-friendly date and time, in English", () => {
    expect(formatDateTime("2026-09-01T10:00:00Z", "en", "UTC")).toBe("Sep 1, 2026, 10:00 AM");
  });

  it("formats an ISO datetime as a locale-friendly date and time, in Hebrew", () => {
    expect(formatDateTime("2026-09-01T10:00:00Z", "he", "UTC")).toBe("1 בספט׳ 2026, 10:00");
  });
});
