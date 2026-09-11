import type { Plugin } from "vite";
import { STORAGE_KEY } from "./src/theme";

// index.html's pre-paint theme script is a plain <script>, not a module —
// it has to run synchronously before first paint, which a `type="module"`
// script (deferred until after parsing) can't do — so it can't `import`
// theme.ts's STORAGE_KEY directly. This substitutes the placeholder it
// carries instead, at both dev-serve and build time, so that one string has
// a single real source instead of two hand-kept-in-sync copies.
//
// Kept out of vite.config.ts itself (which runtime-imports the `vite`
// package for defineConfig) so theme.test.ts can import just this function
// to verify the substitution — importing vite.config.ts directly from a
// running Vitest process re-enters esbuild and breaks.
export function injectThemeStorageKey(): Plugin {
  return {
    name: "turnado-inject-theme-storage-key",
    transformIndexHtml(html) {
      return html.replaceAll("__TURNADO_THEME_STORAGE_KEY__", STORAGE_KEY);
    },
  };
}
