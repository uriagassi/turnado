import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./index.css";
import { applyTheme, getStoredTheme } from "./theme";
import { App } from "./App";

// index.html's inline script already stamped <html data-theme> before this
// module loaded (avoiding a flash of the wrong theme) — this call is
// redundant with that for the very first paint, but it's the one place that
// keeps theme.ts's own persisted value and the DOM attribute in sync should
// they ever disagree (e.g. that inline script is ever removed or changed).
applyTheme(getStoredTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
