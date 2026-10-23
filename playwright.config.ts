import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        },
      },
      testIgnore: "**/mobile.spec.ts",
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 14"],
        launchOptions: {
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        },
      },
      testMatch: "**/mobile.spec.ts",
    },
  ],
  webServer: {
    command: "npm run build && npx next start --port 3100",
    url: "http://localhost:3100/api/health",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://perch:perch@localhost:5432/perch_test",
      SESSION_SECRET: "test-session-secret-must-be-at-least-32-chars-long!!",
      STORAGE_DRIVER: "local",
      UPLOADS_DIR: "./uploads-e2e",
      PERCH_TZ: "UTC",
      PERCH_TEST_MODE: "1",
      PERCH_PUBLIC_ORIGIN: "http://localhost:3100",
    },
  },
});
