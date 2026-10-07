import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node apps/api/node_modules/tsx/dist/cli.mjs scripts/e2e-server.ts",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "pnpm --filter @lifesync/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
