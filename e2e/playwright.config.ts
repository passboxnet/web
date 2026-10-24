import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { adminPort, port } from "./ports";

const dataDir = mkdtempSync(join(tmpdir(), "passbox-e2e-"));

function server(listen: number, database: string) {
  return {
    command: "cargo run --quiet --package passbox-server",
    cwd: "..",
    url: `http://127.0.0.1:${listen}/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    // Server logs (with request timings) show up in CI output.
    stdout: process.env.CI ? ("pipe" as const) : ("ignore" as const),
    env: {
      RUST_LOG: "info,tower_http=debug",
      PASSBOX_BIND: `127.0.0.1:${listen}`,
      PASSBOX_DATABASE_URL: `sqlite://${join(dataDir, database)}?mode=rwc`,
      PASSBOX_WEB_DIR: "apps/web/dist",
      // Every test signs in from 127.0.0.1; the default of 60 per minute
      // is meant for real clients, not a whole test suite.
      PASSBOX_AUTH_RATE_LIMIT: "1000",
    },
  };
}

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // English by default; tests that check German set their own locale.
    locale: "en-US",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: [server(port, "passbox.db"), server(adminPort, "admin.db")],
});
