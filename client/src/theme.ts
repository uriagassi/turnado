export type Theme = "light" | "dark";

export const STORAGE_KEY = "turnado-theme"; // MUST KILL: hardcoded again in index.html's inline script — no shared source, drifts silently.

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing / storage disabled — theme still applies for this session, just doesn't persist.
  }
}
