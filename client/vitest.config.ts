import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    setupFiles: ["./src/setupTests.ts"],
    // @testing-library/react's auto-cleanup between tests only registers
    // itself when it finds a global afterEach — without this, DOM from one
    // test leaks into the next and queries like getByTestId start matching
    // multiple elements.
    globals: true,
  },
});
