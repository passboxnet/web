import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { adminPort } from "../ports";

// A server of its own: its first account becomes instance admin, and
// switching it to invite-only does not affect the other tests.
const BASE = `http://127.0.0.1:${adminPort}`;
const PASSWORD = "correct horse battery staple";

test.use({ baseURL: BASE });
/** The admin account of the first test, for the German one. */
const admin = { email: "", secretKey: "" };
test.describe.configure({ mode: "serial" });

/** Set PASSBOX_E2E_SCREENSHOTS to a directory to keep screenshots of the screens. */
async function screenshot(page: Page, name: string) {
  const dir = process.env.PASSBOX_E2E_SCREENSHOTS;
  if (!dir) return;
  // The app scrolls inside its panes, so a tall window shows a whole screen.
  const size = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 2600 });
  await page.screenshot({ path: join(dir, `${name}.png`) });
  if (size) await page.setViewportSize(size);
}

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Fills in the sign-up form (already showing) and confirms the Emergency Kit. */
async function createAccount(page: Page, email?: string): Promise<string> {
  if (email) await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4).toLowerCase());
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
  return secretKey;
}

test("the first account administers the server and invite-only registration", async ({ page, browser }) => {
  // The first account on a fresh server becomes its administrator.
  admin.email = uniqueEmail("admin");
  await page.goto("/");
  await expect(page.getByRole("radio", { name: "Create account" })).toBeChecked();
  admin.secretKey = await createAccount(page, admin.email);

  await page.getByRole("button", { name: "Administration" }).click();
  await expect(page.getByRole("heading", { name: "Administration", level: 1 })).toBeVisible();
  await expect(page.getByText("Email is not set up")).toBeVisible();
  await expect(page.getByText("Log intact")).toBeVisible();

  await page.getByRole("button", { name: "Send test email" }).click();
  await expect(page.getByText("Test email written to the server log")).toBeVisible();

  // Invite only, with a name and a help address.
  await page.getByLabel("Server name").fill("ACME Passwords");
  await page.getByText("Invited only", { exact: true }).click();
  await expect(page.getByText("Only people you invite can create an account.")).toBeVisible();
  await page.getByLabel("Help address").fill("https://help.example.com");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  const inviteeEmail = uniqueEmail("invitee");
  await page.getByLabel("Email address").fill(inviteeEmail);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByText(`Send this link to ${inviteeEmail} yourself`)).toBeVisible();
  const link = (await page.getByTestId("invite-link").textContent())?.trim() ?? "";
  expect(link).toContain(`${BASE}/#/?invite=`);
  await expect(page.locator("#invites").getByText("Open", { exact: true })).toBeVisible();
  await screenshot(page, "admin-settings");

  // Without an invitation, "Create account" is gone.
  const stranger = await (await browser.newContext({ locale: "en-US" })).newPage();
  await stranger.goto(BASE);
  await expect(stranger.getByText("New accounts on this server need an invitation.")).toBeVisible();
  await expect(stranger.getByRole("radio", { name: "Create account" })).toHaveCount(0);
  await expect(stranger.getByRole("link", { name: "Help for ACME Passwords" })).toHaveAttribute(
    "href",
    "https://help.example.com",
  );
  await screenshot(stranger, "welcome-invite-only");

  // The invitation link opens "Create account" with the email filled in.
  const invitee = await (await browser.newContext({ locale: "en-US" })).newPage();
  await invitee.goto(link);
  await expect(invitee.getByRole("radio", { name: "Create account" })).toBeChecked();
  await expect(invitee.getByLabel("Email")).toHaveValue(inviteeEmail);
  await expect(invitee.getByText("You were invited with this address.")).toBeVisible();
  await screenshot(invitee, "sign-up-invited");
  const inviteeKey = await createAccount(invitee);
  // The used invitation leaves the address bar.
  expect(new URL(invitee.url()).hash).not.toContain("invite=");

  // The admin disables the new account: it is signed out and cannot sign in.
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Administration", level: 1 })).toBeVisible();
  await expect(page.locator("#invites").getByText("Accepted", { exact: true })).toBeVisible();
  await page.getByLabel("Search accounts").fill("invitee");
  const row = page.getByRole("row", { name: new RegExp(inviteeEmail) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Disable" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Disable" }).click();
  await expect(page.getByText(`${inviteeEmail} disabled and signed out everywhere`)).toBeVisible();
  await expect(row.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(page.getByText(`Disabled ${inviteeEmail}`)).toBeVisible();
  await expect(page.getByText("Log intact")).toBeVisible();
  await screenshot(page, "admin-users");

  const other = await (await browser.newContext({ locale: "en-US" })).newPage();
  await other.goto(BASE);
  await other.getByLabel("Email").fill(inviteeEmail);
  await other.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await other.getByLabel("Secret Key").fill(inviteeKey);
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other.getByRole("alert")).toContainText("has been disabled by the administrators");

  // Members see no administration; the notification setting is in Settings.
  await invitee.reload();
  await expect(invitee.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
  await page.goto(`${BASE}/#/settings`);
  await expect(page.getByRole("switch", { name: "Email me when a new device signs in" })).toBeChecked();
  await page.getByRole("switch", { name: "Email me when a new device signs in" }).click();
  await expect(page.getByRole("switch", { name: "Email me when a new device signs in" })).not.toBeChecked();
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("switch", { name: "Email me when a new device signs in" })).not.toBeChecked();
});

test("the administration is in German with formal address", async ({ browser }) => {
  test.skip(!admin.email, "needs the admin of the previous test");
  const page = await (await browser.newContext({ locale: "de-DE" })).newPage();
  await page.goto(BASE);
  // Registration is invite-only now, so only "Anmelden" is offered.
  await expect(page.getByText("Neue Konten auf diesem Server brauchen eine Einladung.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Konto erstellen" })).toHaveCount(0);

  await page.getByLabel("E-Mail").fill(admin.email);
  await page.getByLabel("Master-Passwort", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Geheimschlüssel").fill(admin.secretKey);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.getByRole("button", { name: "Administration" }).click();
  await expect(page.getByText("E-Mail-Versand ist nicht eingerichtet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Testmail senden" })).toBeVisible();
  await expect(page.getByText("Nur Personen, die Sie einladen, können ein Konto erstellen.")).toBeVisible();
  await expect(page.getByText("Protokoll unverändert")).toBeVisible();
  await screenshot(page, "admin-de");
});
