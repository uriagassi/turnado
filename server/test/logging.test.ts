import { describe, it, expect, vi, afterEach } from "vitest";
import { installTimestampedConsole } from "../src/logging.js";

describe("installTimestampedConsole", () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    vi.restoreAllMocks();
  });

  it("prefixes console.log with the given clock's ISO timestamp", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    installTimestampedConsole(() => new Date("2026-09-08T12:00:00.000Z"));

    console.log("hello", 42);

    expect(logSpy).toHaveBeenCalledWith("[2026-09-08T12:00:00.000Z]", "hello", 42);
  });

  it("prefixes console.warn and console.error the same way", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    installTimestampedConsole(() => new Date("2026-09-08T12:00:00.000Z"));

    console.warn("careful");
    console.error("oops");

    expect(warnSpy).toHaveBeenCalledWith("[2026-09-08T12:00:00.000Z]", "careful");
    expect(errorSpy).toHaveBeenCalledWith("[2026-09-08T12:00:00.000Z]", "oops");
  });

  it("re-evaluates the clock on every call, not just at install time", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    let now = new Date("2026-09-08T12:00:00.000Z");
    installTimestampedConsole(() => now);

    console.log("first");
    now = new Date("2026-09-08T13:00:00.000Z");
    console.log("second");

    expect(logSpy).toHaveBeenNthCalledWith(1, "[2026-09-08T12:00:00.000Z]", "first");
    expect(logSpy).toHaveBeenNthCalledWith(2, "[2026-09-08T13:00:00.000Z]", "second");
  });
});
