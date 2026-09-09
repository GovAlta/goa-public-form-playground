import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * CI passes VITE_BASE_PATH as /<repo-name>/ (see .github/workflows/deploy.yml), so a
 * fork deploys with no file edits; locally "/" applies.
 */
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
