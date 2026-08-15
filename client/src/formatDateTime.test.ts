import { describe, it, expect } from "vitest";
import { formatDateTime, formatRelativeDateTime, relativeDayLabel } from "./formatDateTime";

describe("formatDateTime", () => {
  it("formats an ISO datetime as a locale-friendly date and time, in English", () => {
    expect(formatDateTime("2026-09-01T10:00:00Z", "en", "UTC")).toBe("Sep 1, 2026, 10:00 AM");
  });

  it("formats an ISO datetime as a locale-friendly date and time, in Hebrew", () => {
    expect(formatDateTime("2026-09-01T10:00:00Z", "he", "UTC")).toBe("1 בספט׳ 2026, 10:00");
  });
});

describe("relativeDayLabel", () => {
  const now = new Date("2026-09-01T08:00:00Z");

  it("labels a same-calendar-day date as today", () => {
    expect(relativeDayLabel("2026-09-01T20:00:00Z", "en", "Today", "Tomorrow", now, "UTC")).toBe("Today");
  });

  it("labels the next calendar day as tomorrow", () => {
    expect(relativeDayLabel("2026-09-02T09:00:00Z", "en", "Today", "Tomorrow", now, "UTC")).toBe("Tomorrow");
  });

  it("labels 2-6 days out with the weekday name", () => {
    // 2026-09-01 is a Tuesday, so +4 days lands on Saturday.
    expect(relativeDayLabel("2026-09-05T09:00:00Z", "en", "Today", "Tomorrow", now, "UTC")).toBe("Saturday");
  });

  it("returns null once the date is a week or more out, so callers fall back to the full date", () => {
    expect(relativeDayLabel("2026-09-08T09:00:00Z", "en", "Today", "Tomorrow", now, "UTC")).toBeNull();
  });

  it("returns null for a past date", () => {
    expect(relativeDayLabel("2026-08-20T09:00:00Z", "en", "Today", "Tomorrow", now, "UTC")).toBeNull();
  });
});

describe("formatRelativeDateTime", () => {
  const now = new Date("2026-09-01T08:00:00Z");

  it("uses the relative day label and time while the date is near", () => {
    expect(formatRelativeDateTime("2026-09-02T10:00:00Z", "en", "Today", "Tomorrow", now, "UTC")).toBe("Tomorrow, 10:00 AM");
  });

  it("falls back to the full formatted date once it's far enough out", () => {
    expect(formatRelativeDateTime("2026-10-01T10:00:00Z", "en", "Today", "Tomorrow", now, "UTC")).toBe(
      formatDateTime("2026-10-01T10:00:00Z", "en", "UTC"),
    );
  });
});
