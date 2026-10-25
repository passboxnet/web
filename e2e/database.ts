import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * PostgreSQL databases for the e2e test servers. PASSBOX_E2E_DATABASE_URL is
 * a superuser connection; every server gets a database of its own, created by
 * `database.sh`. The server connects through that superuser connection but
 * switches to the production roles at connection start (`-c role=...`), so
 * row level security applies exactly as in production and no role passwords
 * are needed.
 */
function baseUrl(): string {
  const url = process.env.PASSBOX_E2E_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Set PASSBOX_E2E_DATABASE_URL to a PostgreSQL superuser URL, for example " +
        "postgres://postgres:postgres@localhost:5432/postgres (see CONTRIBUTING.md).",
    );
  }
  return url;
}

/** The database name for a server, unique per port so suites can run side by side. */
export function databaseName(label: string, listen: number): string {
  return `passbox_e2e_${label}_${listen}`;
}

/** The server's database settings for `name`. */
export function databaseEnv(name: string): Record<string, string> {
  const as = (role: string) => {
    const url = new URL(baseUrl());
    url.pathname = `/${name}`;
    url.searchParams.set("options", `-c role=${role}`);
    return url.toString();
  };
  return {
    PASSBOX_DATABASE_URL: as("passbox_app"),
    PASSBOX_WORKER_DATABASE_URL: as("passbox_worker"),
    PASSBOX_MIGRATION_DATABASE_URL: as("passbox_migrator"),
  };
}

/** The shell command that creates the database `name`. */
export const createDatabaseCommand = (name: string) => `sh e2e/database.sh ${name}`;

/** Creates the database `name` now (for servers a test starts itself). */
export function createDatabase(name: string): void {
  baseUrl();
  execFileSync("sh", [resolve(import.meta.dirname, "database.sh"), name], { stdio: "inherit" });
}
