import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyTheme, getStoredTheme, STORAGE_KEY } from "./theme";
import { injectThemeStorageKey } from "../viteThemeStoragePlugin";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("defaults to light with nothing stored", () => {
    expect(getStoredTheme()).toBe("light");
  });

  it("treats any stored value other than \"dark\" as light", () => {
    localStorage.setItem(STORAGE_KEY, "sepia");
    expect(getStoredTheme()).toBe("light");
  });

  it("reads back a stored dark preference", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("stamps <html data-theme> and persists the choice", () => {
    applyTheme("dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });
});

describe("theme/index.html sync", () => {
  // process.cwd() rather than import.meta.url — vitest doesn't run this file
  // as a real file:// module, so new URL(...).href doesn't resolve to a
  // usable filesystem path. vitest.config.ts (and thus the vitest process)
  // lives at the client/ package root, one level up from src/, same as
  // index.html.
  const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf-8");

  it("carries the placeholder vite.config.ts's injectThemeStorageKey plugin substitutes", () => {
    expect(indexHtml).toContain("__TURNADO_THEME_STORAGE_KEY__");
  });

  it("has the plugin substitute in the real, current STORAGE_KEY", () => {
    const transform = injectThemeStorageKey().transformIndexHtml as (html: string) => string;

    expect(transform(indexHtml)).toContain(`localStorage.getItem("${STORAGE_KEY}")`);
  });

  it("falls back to the same default (light) theme.ts's getStoredTheme() does", () => {
    expect(indexHtml).toContain('document.documentElement.dataset.theme = "light"');
  });
});
