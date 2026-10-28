import { defineConfig } from "@playwright/test";

// E2E runs against a production build and its own database (steady_e2e by default),
// seeded with the sample org in global-setup.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/steady_e2e";
export const E2E_SECRET = "e2e-test-secret-not-for-production-0123456789";
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/favicon.ico`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_SECRET: E2E_SECRET,
      ALLOWED_EMAIL_DOMAINS: "example.com",
    },
  },
});
