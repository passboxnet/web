import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { port } from "../ports";

const PASSWORD = "correct horse battery staple";
const SERVER = `http://127.0.0.1:${port}`;
/** The `pbx` binary from passboxnet/cli (PBX_BIN, or `pbx` on the PATH). */
const PBX = process.env.PBX_BIN ?? "pbx";
/** Set to a directory to save screenshots of the approval page. */
const SHOTS = process.env.PASSBOX_SCREENSHOTS;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

function uniqueEmail() {
  return `cli-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page, email: string): Promise<string> {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).last().click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
  return secretKey;
}

/**
 * `pbx login` in a pseudo-terminal (it refuses to sign in without one),
 * through Python's pty module. The master password comes from
 * PASSBOX_PASSWORD.
 */
class PbxLogin {
  readonly child: ChildProcess;
  readonly dataDir = mkdtempSync(join(tmpdir(), "pbx-login-"));
  output = "";
  readonly exited: Promise<number | null>;

  constructor() {
    const args = [PBX, "login", "--server", SERVER, "--no-browser"];
    const env: NodeJS.ProcessEnv = { ...process.env, PASSBOX_DATA_DIR: this.dataDir, PASSBOX_PASSWORD: PASSWORD };
    // GitHub Actions sets CI=true, which (rightly) turns the browser sign-in off.
    delete env.CI;
    delete env.PASSBOX_SERVICE_ACCOUNT_TOKEN;
    this.child = spawn("python3", ["-c", "import pty, sys; sys.exit(pty.spawn(sys.argv[1:]) >> 8)", ...args], {
      env,
    });
    this.child.stdout?.on("data", (chunk: Buffer) => {
      this.output += chunk.toString();
    });
    this.exited = new Promise((resolve) => this.child.on("exit", (code) => resolve(code)));
  }

  /** The link pbx printed. */
  async link(): Promise<{ url: string; id: string }> {
    await expect.poll(() => /http\S+#\/cli-login\/[0-9a-z]{26}#[A-Za-z0-9_-]{43}/.exec(this.output)?.[0]).toBeTruthy();
    const url = /http\S+#\/cli-login\/[0-9a-z]{26}#[A-Za-z0-9_-]{43}/.exec(this.output)?.[0] ?? "";
    const id = /#\/cli-login\/([0-9a-z]{26})#/.exec(url)?.[1] ?? "";
    return { url, id };
  }
}

test("approve pbx login in the signed-in web vault", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  const pbx = new PbxLogin();
  try {
    const { url, id } = await pbx.link();
    expect(url.startsWith(`${SERVER}/#/cli-login/`)).toBe(true);
    await page.goto(url);
    // The secret leaves the address bar at once.
    await expect(page).toHaveURL(`${SERVER}/#/cli-login/${id}`);
    const request = page.getByTestId("cli-login-request");
    await expect(request).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Sign in pbx .+\?$/ })).toBeVisible();
    await expect(page.getByTestId("cli-login-ip")).toHaveText("127.0.0.1");
    await expect(page.getByText("full access to your account")).toBeVisible();
    // Approve needs the explicit confirmation.
    await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
    await page.getByTestId("cli-login-confirm").check();
    await shot(page, "en-cli-login-request");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("pbx can continue")).toBeVisible();
    await shot(page, "en-cli-login-approved");

    expect(await pbx.exited).toBe(0);
    expect(pbx.output).toContain(email);
    expect(pbx.output).toContain(`Signed in as ${email}`);
    // The machine is signed in: vault commands work with the master password.
    const status = execFileSync(PBX, ["status"], { env: { ...process.env, PASSBOX_DATA_DIR: pbx.dataDir } });
    expect(status.toString()).toContain(email);
  } finally {
    pbx.child.kill();
  }
});

test("sign in first, then deny pbx login", async ({ page, browser }) => {
  const email = uniqueEmail();
  const secretKey = await signUp(page, email);
  const pbx = new PbxLogin();
  try {
    const { url, id } = await pbx.link();
    // A browser where nobody is signed in yet, in German.
    const context = await browser.newContext({ locale: "de-DE" });
    const other = await context.newPage();
    await other.goto(url);
    await expect(other).toHaveURL(`${SERVER}/#/cli-login/${id}`);
    await expect(other.getByText("pbx wartet auf Ihre Bestätigung.")).toBeVisible();
    await other.locator("fieldset").getByText("Anmelden", { exact: true }).click();
    await other.getByLabel("E-Mail").fill(email);
    await other.getByLabel("Master-Passwort", { exact: true }).fill(PASSWORD);
    await other.getByLabel("Geheimschlüssel").fill(secretKey);
    await other.getByRole("button", { name: "Anmelden" }).click();
    // After signing in, the request is back.
    await expect(other.getByTestId("cli-login-request")).toBeVisible({ timeout: 30_000 });
    await expect(other.getByText("Waren Sie das?")).toBeVisible();
    await shot(other, "de-cli-login-request");
    await other.getByRole("button", { name: "Ablehnen" }).click();
    await expect(other.getByText("Anfrage abgelehnt")).toBeVisible();

    expect(await pbx.exited).not.toBe(0);
    expect(pbx.output).toContain("denied in the browser");
    await context.close();
  } finally {
    pbx.child.kill();
  }
});
