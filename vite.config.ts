import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * The base path is never hardcoded.
 *
 * CI passes VITE_BASE_PATH as /<your-repo-name>/ (see .github/workflows/deploy.yml),
 * so a repo created from this template deploys to its own GitHub Pages URL with no
 * file edits. Locally the fallback "/" applies and `npm run dev` just works.
 *
 * The router reads the same value back via import.meta.env.BASE_URL, so routing and
 * asset paths can never disagree.
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
