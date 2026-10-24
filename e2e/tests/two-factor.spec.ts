import { createHmac } from "node:crypto";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

/**
 * Two-factor sign-in in the web app: turning on an authenticator app,
 * signing in on a new device with a code and "remember this device",
 * unlocking with a recovery code, and a security key (Chromium's virtual
 * authenticator). Set PASSBOX_SCREENSHOTS to a directory to save
 * screenshots of the screens.
 */

const PASSWORD = "correct horse battery staple";
const screenshots = process.env.PASSBOX_SCREENSHOTS;

async function shot(page: Page, name: string) {
  if (screenshots) await page.screenshot({ path: join(screenshots, `2fa-${name}.png`) });
}

function uniqueEmail() {
  return `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) for `steps` periods from now. */
function totp(secret: string, steps = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/\s/g, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + steps));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const value = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

async function signUp(page: Page, email: string): Promise<string> {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
  return secretKey;
}

async function openSettings(page: Page) {
  await page.evaluate(() => {
    window.location.hash = "#/settings";
  });
  await expect(page.getByRole("heading", { name: "Two-factor sign-in" })).toBeVisible();
}

async function unlock(page: Page) {
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
}

test("turn on an authenticator app and sign in with it", async ({ page, browser }) => {
  const email = uniqueEmail();
  const secretKey = await signUp(page, email);
  await openSettings(page);
  const panel = page.locator("#two-factor");
  await expect(panel.getByText("Off", { exact: true })).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  await shot(page, "settings-off");

  await panel.getByRole("button", { name: "Set up" }).click();
  const dialog = page.getByRole("dialog", { name: "Set up an authenticator app" });
  await expect(dialog.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  const secret = ((await dialog.getByTestId("totp-secret").textContent()) ?? "").replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await shot(page, "setup-qr");
  await dialog.getByLabel("Enter the 6-digit code").fill("000000" === totp(secret) ? "111111" : "000000");
  await dialog.getByRole("button", { name: "Turn on" }).click();
  await expect(dialog.getByRole("alert")).toContainText("isn't correct");
  await dialog.getByLabel("Enter the 6-digit code").fill(totp(secret));
  await dialog.getByRole("button", { name: "Turn on" }).click();

  // Recovery codes are shown once.
  const codesDialog = page.getByRole("dialog", { name: "Save your recovery codes" });
  await expect(codesDialog.getByTestId("recovery-codes").locator("li")).toHaveCount(10);
  const codes = (await codesDialog.getByTestId("recovery-codes").locator("li").allTextContents()).map((c) => c.trim());
  expect(codes).toHaveLength(10);
  for (const code of codes) expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
  await expect(codesDialog.getByRole("button", { name: "Done" })).toBeDisabled();
  await shot(page, "recovery-codes");
  await codesDialog.getByRole("switch", { name: "I have saved these codes" }).click();
  await codesDialog.getByRole("button", { name: "Done" }).click();
  await expect(panel.getByText("On", { exact: true })).toBeVisible();
  await expect(panel.getByText("10 of 10 unused")).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  await shot(page, "settings-on");

  // A new device: password and Secret Key, then the code.
  const phone = await (await browser.newContext({ locale: "en-US" })).newPage();
  await phone.goto("/");
  await phone.locator("fieldset").getByText("Sign in", { exact: true }).click();
  await phone.getByLabel("Email").fill(email);
  await phone.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await phone.getByLabel("Secret Key").fill(secretKey);
  await phone.getByRole("button", { name: "Sign in" }).click();
  await expect(phone.getByRole("heading", { name: "Confirm it's you" })).toBeVisible({ timeout: 30_000 });
  await shot(phone, "sign-in-step");
  await phone.getByLabel("Code from the app").fill(totp(secret));
  await phone.getByRole("button", { name: "Confirm" }).click();
  // The code that turned 2FA on was used already.
  await expect(phone.getByRole("alert")).toContainText("isn't correct");
  await phone.getByLabel("Code from the app").fill(totp(secret, 1));
  await phone.getByRole("switch", { name: "Remember this device for 30 days" }).click();
  await phone.getByRole("button", { name: "Confirm" }).click();
  await expect(phone.getByText("No passwords saved yet")).toBeVisible();

  // The remembered device unlocks with the master password alone.
  await phone.reload();
  await unlock(phone);
  await expect(phone.getByRole("button", { name: "New item" })).toBeVisible();
  await expect(phone.getByRole("heading", { name: "Confirm it's you" })).toHaveCount(0);

  // The first device was not remembered: unlocking asks again; a recovery code works.
  await page.reload();
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
  await page.getByRole("button", { name: "Use a recovery code instead" }).click();
  await page.getByLabel("Recovery code").fill(codes[0]?.toLowerCase() ?? "");
  await shot(page, "unlock-recovery");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(/Recovery code used\. 9 codes left\./)).toBeVisible();

  // Unlocked, back on Settings: the activity log shows it.
  await expect(page.locator("#two-factor").getByText("9 of 10 unused")).toBeVisible();
  await expect(page.locator("#activity").getByText("Recovery code used")).toBeVisible();
  await expect(page.locator("#activity").getByText("Two-factor sign-in turned on")).toBeVisible();
});

test("German: the second step uses formal wording", async ({ browser }) => {
  const page = await (await browser.newContext({ locale: "de-DE" })).newPage();
  await page.goto("/");
  await page.getByLabel("E-Mail").fill(uniqueEmail());
  await page.getByLabel("Master-Passwort", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Master-Passwort wiederholen").fill(PASSWORD);
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/letzten 4 Zeichen/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Weiter zu meinem Tresor" }).click();
  await page.evaluate(() => {
    window.location.hash = "#/settings";
  });
  const panel = page.locator("#two-factor");
  await expect(panel.getByRole("heading", { name: "Zwei-Faktor-Anmeldung" })).toBeVisible();
  await panel.getByRole("button", { name: "Einrichten" }).click();
  const dialog = page.getByRole("dialog", { name: "Authenticator-App einrichten" });
  const secret = ((await dialog.getByTestId("totp-secret").textContent()) ?? "").replace(/\s/g, "");
  await dialog.getByLabel("Geben Sie den 6-stelligen Code ein").fill(totp(secret));
  await dialog.getByRole("button", { name: "Einschalten" }).click();
  await expect(page.getByRole("dialog", { name: "Speichern Sie Ihre Wiederherstellungscodes" })).toBeVisible();
  await page.getByRole("switch", { name: "Ich habe diese Codes gespeichert" }).click();
  await page.getByRole("button", { name: "Fertig" }).click();
  await panel.scrollIntoViewIfNeeded();
  await shot(page, "settings-de");

  await page.reload();
  await page.getByLabel("Master-Passwort", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entsperren" }).click();
  await expect(page.getByRole("heading", { name: "Bestätigen Sie, dass Sie es sind" })).toBeVisible();
  await expect(page.getByText("Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.")).toBeVisible();
  await shot(page, "unlock-de");
  await page.getByLabel("Code aus der App").fill(totp(secret, 1));
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.locator("#two-factor").getByText("An", { exact: true })).toBeVisible();
});

test("a security key as the second factor", async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== "chromium", "uses Chromium's virtual authenticator");
  // WebAuthn needs a secure context with a domain: localhost, not 127.0.0.1.
  const port = new URL(baseURL ?? "").port;
  const page = await (await browser.newContext({ locale: "en-US", baseURL: `http://localhost:${port}` })).newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: false,
      hasUserVerification: false,
      automaticPresenceSimulation: true,
    },
  });
  await signUp(page, uniqueEmail());
  await openSettings(page);
  const panel = page.locator("#two-factor");
  await panel.getByRole("button", { name: "Add security key" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a security key" });
  await dialog.getByLabel("Name").fill("Test key");
  await dialog.getByRole("button", { name: "Continue" }).click();
  const codesDialog = page.getByRole("dialog", { name: "Save your recovery codes" });
  await expect(codesDialog).toBeVisible();
  await codesDialog.getByRole("switch", { name: "I have saved these codes" }).click();
  await codesDialog.getByRole("button", { name: "Done" }).click();
  await expect(panel.getByText("Test key")).toBeVisible();
  await shot(page, "security-key");

  await page.reload();
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
  await page.getByRole("button", { name: "Use security key" }).click();
  // Unlocked, back on Settings (the reload kept the route).
  await expect(page.locator("#activity").getByText("Signed in with a second factor")).toBeVisible();
});
