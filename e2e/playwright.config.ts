import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const port = 8787;
const dataDir = mkdtempSync(join(tmpdir(), "passbox-e2e-"));

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "cargo run --quiet --package passbox-server",
    cwd: "..",
    url: `http://127.0.0.1:${port}/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      PASSBOX_BIND: `127.0.0.1:${port}`,
      PASSBOX_DATABASE_URL: `sqlite://${join(dataDir, "passbox.db")}?mode=rwc`,
      PASSBOX_WEB_DIR: "apps/web/dist",
    },
  },
});
