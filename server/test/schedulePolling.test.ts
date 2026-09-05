import { describe, it, expect, vi, afterEach } from "vitest";
import { schedulePolling } from "../src/schedulePolling.js";

describe("schedulePolling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the poll immediately, before any interval elapses (issue #10: run once on startup)", () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue(undefined);

    schedulePolling(fn, 60 * 60 * 1000);

    expect(fn).toHaveBeenCalledOnce();
  });

  it("runs the poll again once intervalMs elapses (issue #10: hourly poll)", () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue(undefined);

    schedulePolling(fn, 60 * 60 * 1000);
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stops polling once stop() is called", () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue(undefined);

    const { stop } = schedulePolling(fn, 60 * 60 * 1000);
    stop();
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(fn).toHaveBeenCalledOnce(); // only the immediate run-on-start call
  });

  it("catches and logs a rejected poll instead of leaving it unhandled", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValue(new Error("SMTP down"));

    schedulePolling(fn, 60 * 60 * 1000);
    await new Promise((resolve) => setImmediate(resolve)); // let the immediate call's rejection settle

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
