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
    proxy: {
      "/api": "http://localhost:4001",
      "/auth": "http://localhost:4001",
      "/photos": "http://localhost:4001",
    },
  },
});
