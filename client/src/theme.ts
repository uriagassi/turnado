export type Theme = "light" | "dark";

/**
 * Also hardcoded (can't import a TS const into a plain <script> tag) in
 * index.html's inline pre-paint script, which stamps the stored theme onto
 * <html> before the stylesheet renders anything — keep both in sync if this
 * ever changes.
 */
const STORAGE_KEY = "turnado-theme";

/**
 * The user's stored theme preference, defaulting to "light" — unlike
 * locale, this isn't server-resolved (it's not part of the user record), so
 * it lives in localStorage per-browser rather than in Session. Guarded the
 * same way index.css's light-dark() tokens don't need to be: this can throw
 * in a locked-down browser context (private browsing, storage disabled), in
 * which case the default light theme applies for the session without
 * persisting.
 */
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Stamps the theme on <html> as data-theme, which index.css keys its
 * color-scheme override off of (see :root[data-theme="dark"]) — every color
 * token in that file is already a light-dark() pair, so this one attribute
 * flips the whole app. Also persists the choice for next visit.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing / storage disabled — theme still applies for this session, just doesn't persist.
  }
}
