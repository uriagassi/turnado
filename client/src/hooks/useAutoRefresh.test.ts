import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAutoRefresh } from "./useAutoRefresh";

describe("useAutoRefresh", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onRefresh again after intervalMs elapses", () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    renderHook(() => useAutoRefresh(onRefresh, 45_000));
    expect(onRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(45_000);

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("calls onRefresh when the window regains focus", () => {
    const onRefresh = vi.fn();
    renderHook(() => useAutoRefresh(onRefresh, 45_000));

    window.dispatchEvent(new Event("focus"));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("stops refreshing once unmounted", () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    const { unmount } = renderHook(() => useAutoRefresh(onRefresh, 45_000));

    unmount();
    vi.advanceTimersByTime(45_000);
    window.dispatchEvent(new Event("focus"));

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
