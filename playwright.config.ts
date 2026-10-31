import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://localhost:3109", trace: "retain-on-failure" },
  webServer: {
    command: "npx tsx tests/fixtures/start.ts",
    url: "http://localhost:3109/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
