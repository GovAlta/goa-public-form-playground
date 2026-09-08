import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for this template.
 *
 * One spec, deliberately. See e2e/smoke.spec.ts for what it covers and why those
 * three things and nothing else.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:5173",
    // Kept on retry only. A trace per run is a lot of disk for a suite this small.
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
