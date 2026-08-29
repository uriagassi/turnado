import { describe, it, expect } from "vitest";
import { deepMerge } from "../src/setup/deepMerge.js";

describe("deepMerge", () => {
  it("overlays a flat patch onto a flat base", () => {
    expect(deepMerge({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
  });

  it("merges nested objects instead of replacing the whole branch", () => {
    const base = { db: { path: "old-path", busyTimeoutMs: 5000 } };
    const patch = { db: { path: "new-path" } };
    expect(deepMerge(base, patch)).toEqual({
      db: { path: "new-path", busyTimeoutMs: 5000 },
    });
  });

  it("adds new keys the base didn't have, at any depth", () => {
    const base = { mail: { host: "smtp.example.com" } };
    const patch = { mail: { port: 587 }, security: { cookieSecret: "abc" } };
    expect(deepMerge(base, patch)).toEqual({
      mail: { host: "smtp.example.com", port: 587 },
      security: { cookieSecret: "abc" },
    });
  });

  it("replaces a primitive with an object and vice versa rather than merging them", () => {
    expect(deepMerge({ a: "x" }, { a: { nested: true } })).toEqual({ a: { nested: true } });
    expect(deepMerge({ a: { nested: true } }, { a: "x" })).toEqual({ a: "x" });
  });

  it("does not mutate either input", () => {
    const base = { a: { x: 1 } };
    const patch = { a: { y: 2 } };
    const result = deepMerge(base, patch);
    expect(base).toEqual({ a: { x: 1 } });
    expect(patch).toEqual({ a: { y: 2 } });
    expect(result).toEqual({ a: { x: 1, y: 2 } });
  });
});
