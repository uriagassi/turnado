import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme, getStoredTheme } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("defaults to light with nothing stored", () => {
    expect(getStoredTheme()).toBe("light");
  });

  it("treats any stored value other than \"dark\" as light", () => {
    localStorage.setItem("turnado-theme", "sepia");
    expect(getStoredTheme()).toBe("light");
  });

  it("reads back a stored dark preference", () => {
    localStorage.setItem("turnado-theme", "dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("stamps <html data-theme> and persists the choice", () => {
    applyTheme("dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("turnado-theme")).toBe("dark");
  });
});
