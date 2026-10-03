import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { STORAGE_STATE } from "./support/env";

const envFile = path.resolve(__dirname, ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Logs in once and saves the session for the dashboard project.
    // "logout" is its teardown because signing out revokes every session of
    // the test user, so it has to run after all the dashboard specs.
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "logout" },
    {
      name: "auth",
      testDir: "./tests/auth",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "dashboard",
      testDir: "./tests/dashboard",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
    {
      name: "logout",
      testDir: "./tests/session",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Starts the web app from the sibling project unless BASE_URL points elsewhere.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        cwd: path.resolve(__dirname, "../Bitacora360WebProyect"),
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
