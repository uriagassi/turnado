import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-time proxy to the app server (port from config/default.json's
// server.port) so the client can be run standalone with `vite` while
// still hitting real /api, /auth, and /photos routes and sharing cookies.
// /photos is the doctor-photo static route (see server/src/app.ts) — without
// it here, an <img src="/photos/...">  in dev falls through to Vite's own
// SPA-fallback index.html instead of the actual file.
export default defineConfig({
  plugins: [react()],
  server: {
    // Respect an assigned PORT (e.g. from the dev harness's autoPort) so the
    // client doesn't collide with another instance already on the default
    // 5173 — falls back to Vite's usual default when PORT isn't set.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      "/api": "http://localhost:4001",
      "/auth": "http://localhost:4001",
      "/photos": "http://localhost:4001",
    },
  },
});
