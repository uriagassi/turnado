import { describe, it, expect, vi, afterEach } from "vitest";
import { celebrate, celebrateAfter, celebrationPoint } from "./celebrate";

// Smoke level only, per issue #13: the effect is a validated design choice,
// so these check that it renders and cleans up — not how it animates.
describe("celebration", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("stamps 'Done' at the given point, adds a confetti puff on impact, and cleans both up", () => {
    vi.useFakeTimers();
    celebrate({ x: 200, y: 300 });

    const stamp = document.querySelector<HTMLElement>(".celebration-stamp");
    expect(stamp).toHaveTextContent("Done");
    expect(stamp?.style.top).toBe("300px");

    vi.advanceTimersByTime(250);
    expect(document.querySelectorAll(".celebration-confetti").length).toBeGreaterThan(0);

    vi.advanceTimersByTime(2000);
    expect(document.querySelector(".celebration-stamp")).toBeNull();
    expect(document.querySelector(".celebration-confetti")).toBeNull();
  });

  it("uses the pointer position for a real click and the anchor's centre otherwise", () => {
    const anchor = document.createElement("button");
    anchor.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 40 }) as DOMRect;

    expect(celebrationPoint(anchor, { clientX: 5, clientY: 6, detail: 1 })).toEqual({ x: 5, y: 6 });
    // detail 0: keyboard-activated click — no meaningful pointer position.
    expect(celebrationPoint(anchor, { clientX: 0, clientY: 0, detail: 0 })).toEqual({ x: 60, y: 40 });
    expect(celebrationPoint(anchor)).toEqual({ x: 60, y: 40 });
  });

  it("celebrates only once the save succeeds", async () => {
    const anchor = document.createElement("button");
    await expect(
      celebrateAfter(anchor, undefined, () => Promise.reject(new Error("save failed"))),
    ).rejects.toThrow("save failed");
    expect(document.querySelector(".celebration-stamp")).toBeNull();

    await celebrateAfter(anchor, undefined, () => Promise.resolve());
    expect(document.querySelector(".celebration-stamp")).not.toBeNull();
  });
});
