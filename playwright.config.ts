import { defineConfig } from "@playwright/test";

// Local smoke only (not part of `pnpm verify`). The defaults below are test-only
// values for a throwaway local server; they are never a deploy value.
const DEFAULT_E2E_PASSWORD = "e2e-local-password-0123456789";
const DEFAULT_E2E_SECRET =
  "e2e-local-session-secret-0123456789-abcdefghijklmnopqrstuvwxyz-0123456789";

const appPassword = process.env.E2E_APP_PASSWORD ?? DEFAULT_E2E_PASSWORD;
const sessionSecret = process.env.E2E_SESSION_SECRET ?? DEFAULT_E2E_SECRET;

// The spec reads the effective password from here.
process.env.E2E_APP_PASSWORD = appPassword;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3210",
    // Installed Google Chrome; the cached Playwright Chromium builds do not match 1.64.
    channel: "chrome",
  },
  webServer: {
    command: "pnpm build && pnpm start -p 3210",
    url: "http://localhost:3210/login",
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      APP_PASSWORD: appPassword,
      SESSION_SECRET: sessionSecret,
    },
  },
});
