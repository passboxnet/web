import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { type MockIdp, startMockIdp } from "../fixtures/mock-idp";
import { port } from "../ports";

/**
 * Single sign-on against a mock OpenID Connect provider: an admin sets up
 * SSO, tests it, signs in with SSO on a new device (master password and
 * Secret Key still needed), trusts the browser and then unlocks with SSO
 * only. Runs its own server, because SSO needs PASSBOX_PUBLIC_URL.
 */
const PASSWORD = "correct horse battery staple";
const SSO_PORT = port + 2;
const BASE = `http://127.0.0.1:${SSO_PORT}`;
const shots = process.env.PASSBOX_SCREENSHOT_DIR;

let server: ChildProcess | undefined;
let idp: MockIdp;
let signedInAs = "";

test.beforeAll(async () => {
  test.setTimeout(300_000);
  idp = await startMockIdp({ email: (hint) => hint ?? signedInAs });
  const dataDir = mkdtempSync(join(tmpdir(), "passbox-e2e-sso-"));
  server = spawn("cargo", ["run", "--quiet", "--package", "passbox-server"], {
    cwd: resolve(import.meta.dirname, "../.."),
    stdio: "ignore",
    env: {
      ...process.env,
      PASSBOX_BIND: `127.0.0.1:${SSO_PORT}`,
      PASSBOX_DATABASE_URL: `sqlite://${join(dataDir, "sso.db")}?mode=rwc`,
      PASSBOX_WEB_DIR: "apps/web/dist",
      PASSBOX_PUBLIC_URL: BASE,
      PASSBOX_SSO_ALLOW_HTTP_LOOPBACK: "1",
      PASSBOX_AUTH_RATE_LIMIT: "1000",
    },
  });
  for (let i = 0; i < 600; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("the SSO test server did not start");
});

test.afterAll(async () => {
  server?.kill();
  await idp?.close();
});

async function shot(page: Page, name: string) {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
}

async function newPage(browser: Browser, locale = "en-US"): Promise<Page> {
  const context = await browser.newContext({ locale, viewport: { width: 1280, height: 800 } });
  return context.newPage();
}

test("an admin sets up SSO, signs in with it and unlocks a trusted browser without the master password", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const email = `ada-${Date.now()}@acme.example`;
  signedInAs = email;
  const page = await newPage(browser);
  await page.goto(`${BASE}/`);

  // Sign up and create a team.
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).last().click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await page.getByRole("button", { name: "Family & team" }).click();
  await page.getByRole("button", { name: "Create a team" }).first().click();
  await page.getByLabel("Team name").fill("Acme");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByRole("heading", { name: "Acme", level: 1 })).toBeVisible();

  // Open the SSO settings and configure the provider.
  await page.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByRole("heading", { name: "Single sign-on", level: 1 })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Provider" }).getByRole("radio", { name: "Keycloak" }).click();
  await page.getByLabel("Name on the sign-in button", { exact: true }).fill("Acme Identity");
  await page.getByLabel("Issuer URL", { exact: true }).fill(idp.issuer);
  await page.getByLabel("Client ID", { exact: true }).fill(idp.clientId);
  await page.getByLabel("Client secret", { exact: true }).fill(idp.clientSecret);
  await page.getByLabel("Email domains", { exact: true }).fill("acme.example");
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByTestId("sso-check")).toContainText("publishes 1 signing key");
  await page.getByRole("switch", { name: "Single sign-on is on" }).click();
  await page.getByRole("switch", { name: "Allow unlocking with single sign-on" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Single sign-on is on.")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "/api/v1/sso/callback" })).toBeVisible();

  // Test sign-in in a popup: the result shows what the provider sent.
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Test sign-in" }).click();
  const popup = await popupPromise;
  await popup.getByRole("link", { name: "Continue to Passbox" }).click();
  await expect(page.getByTestId("sso-test-result")).toContainText("Would sign in");
  await expect(page.getByTestId("sso-test-result")).toContainText("engineering");
  await shot(page, "sso-settings-en");

  // SCIM: a token and a provisioned person waiting for an invitation.
  await page.getByRole("button", { name: "Create token" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Acme directory");
  await page.getByRole("dialog").getByRole("button", { name: "Create token" }).click();
  const token = (await page.getByTestId("scim-token").textContent())?.trim() ?? "";
  expect(token).toMatch(/^pbx_scim_/);
  await page.getByRole("button", { name: "Done" }).click();
  const created = await fetch(`${BASE}/api/v1/scim/v2/Users`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/scim+json" },
    body: JSON.stringify({ userName: "bob@acme.example", displayName: "Bob Builder", active: true }),
  });
  expect(created.status).toBe(201);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.locator("#scim")).toContainText("Bob Builder");
  await expect(page.locator("#scim")).toContainText("Invited");
  await page.locator("#scim").scrollIntoViewIfNeeded();
  await shot(page, "sso-scim-en");

  // Sign out; on the sign-in page the email domain offers SSO.
  // (Settings also lists "Sign out" for other devices, so go via the lock screen.)
  await page.getByRole("button", { name: "Lock vault" }).click();
  await page.getByRole("button", { name: "Use a different account…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Passbox" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await expect(page.getByTestId("sso-option")).toContainText("Acme Identity can sign you in.");
  await shot(page, "sso-sign-in-en");
  await page.getByRole("button", { name: "Continue with single sign-on" }).click();
  await page.getByRole("link", { name: "Continue to Passbox" }).click();
  // Confirmed by the provider; decrypting still needs password and Secret Key.
  await expect(page.getByRole("heading", { name: "Confirmed by your organization" })).toBeVisible();
  await shot(page, "sso-callback-en");
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Secret Key").fill(secretKey);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation").getByRole("button", { name: "All items" })).toBeVisible();

  // Trust this browser, lock, and unlock with SSO only.
  await page.goto(`${BASE}/#/settings`);
  await page.getByRole("button", { name: "Trust this browser" }).click();
  await expect(page.locator("#trusted-devices").getByText("Trusted", { exact: true })).toBeVisible();
  await page.locator("#trusted-devices").scrollIntoViewIfNeeded();
  await shot(page, "sso-trusted-devices-en");
  await page.getByRole("button", { name: "Lock vault" }).first().click();
  await expect(page.getByRole("button", { name: "Unlock with single sign-on" })).toBeVisible();
  await shot(page, "sso-unlock-en");
  await page.getByRole("button", { name: "Unlock with single sign-on" }).click();
  await page.getByRole("link", { name: "Continue to Passbox" }).click();
  await expect(page.getByRole("navigation").getByRole("button", { name: "All items" })).toBeVisible();
});

test("German: the SSO callback explains what is still needed", async ({ browser }) => {
  const page = await newPage(browser, "de-DE");
  await page.goto(`${BASE}/#/sso?error=sso_not_member`);
  await expect(page.getByRole("heading", { name: "Single Sign-on hat nicht funktioniert" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("noch kein Mitglied");
  await shot(page, "sso-error-de");
});
