import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-time proxy to the app server (port from config/default.json's
// server.port) so the client can be run standalone with `vite` while
// still hitting real /api and /auth routes and sharing cookies.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4001",
      "/auth": "http://localhost:4001",
    },
  },
});
