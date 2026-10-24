import { type Browser, expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "violet ocean lantern 42 maple";

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: "en-US" });
  return context.newPage();
}

async function confirmKit(page: Page, secretKey: string) {
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();
}

async function signUp(page: Page, email: string, options: { recoveryCode?: boolean } = {}) {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  if (options.recoveryCode) await page.getByRole("switch", { name: /Add a recovery code/ }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  const recoveryCode = options.recoveryCode
    ? ((await page.getByTestId("recovery-code").textContent())?.trim() ?? "")
    : "";
  await confirmKit(page, secretKey);
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
  return { secretKey, recoveryCode };
}

async function addLogin(page: Page, title: string, password: string) {
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: "Login" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
}

/** Opens a settings panel without reloading (a reload locks the vault). */
async function openSettings(page: Page, section: string) {
  await page.evaluate(() => {
    window.location.hash = "#/items";
  });
  await page.evaluate((s) => {
    window.location.hash = `#/settings/${s}`;
  }, section);
}

test("recover a forgotten master password with the recovery code", async ({ page, browser }) => {
  const email = uniqueEmail("recover");
  const { secretKey, recoveryCode } = await signUp(page, email, { recoveryCode: true });
  expect(recoveryCode).toMatch(/^R1(-[0-9A-Z]{5}){11}$/);
  await addLogin(page, "Bank", "s3cret-bank");

  // A new device without the master password.
  const device = await newDevice(browser);
  await device.goto("/");
  await device.locator("fieldset").getByText("Sign in", { exact: true }).click();
  await device.getByRole("button", { name: "Forgot your master password?" }).click();
  await device.getByRole("dialog").getByRole("button", { name: "Enter recovery code" }).click();
  await device.getByLabel("Email").fill(email);
  // A typo is caught on the device.
  await device
    .getByLabel("Recovery code")
    .fill(`${recoveryCode.slice(0, -1)}${recoveryCode.endsWith("A") ? "B" : "A"}`);
  await expect(device.getByText("That's not a complete recovery code")).toBeVisible();
  await device.getByLabel("Recovery code").fill(recoveryCode.toLowerCase());
  await device.getByRole("button", { name: "Continue" }).click();

  await expect(device.getByRole("heading", { name: "Choose a new master password" })).toBeVisible({
    timeout: 30_000,
  });
  await device.getByLabel("New master password").fill(NEW_PASSWORD);
  await device.getByLabel("Confirm master password").fill(NEW_PASSWORD);
  await device.getByRole("button", { name: "Save and open vault" }).click();

  await expect(device.getByRole("heading", { name: "Your new Emergency Kit" })).toBeVisible({ timeout: 30_000 });
  const newKey = (await device.getByTestId("secret-key").textContent())?.trim() ?? "";
  const newCode = (await device.getByTestId("recovery-code").textContent())?.trim() ?? "";
  expect(newKey).not.toBe(secretKey);
  expect(newCode).not.toBe(recoveryCode);
  await confirmKit(device, newKey);
  await expect(device.getByRole("region", { name: "All items" }).getByText("Bank")).toBeVisible();

  // The first device was signed out; its old Secret Key no longer works.
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("emergency access after the grantor allows it", async ({ page, browser }) => {
  const grantorEmail = uniqueEmail("grantor");
  const granteeEmail = uniqueEmail("grantee");
  await signUp(page, grantorEmail);
  await addLogin(page, "Insurance", "policy-123");
  const grantee = await newDevice(browser);
  await signUp(grantee, granteeEmail);

  // The grantor invites the grantee.
  await openSettings(page, "emergency");
  await page.getByRole("button", { name: "Add contact" }).click();
  const add = page.getByRole("dialog");
  await add.getByLabel("Their email").fill(granteeEmail);
  await expect(add.getByLabel("Waiting period")).toHaveValue("7");
  await add.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Waiting for them to accept the invitation.")).toBeVisible();

  // The grantee accepts.
  await openSettings(grantee, "emergency");
  await grantee.getByRole("button", { name: "Accept" }).click();
  await expect(grantee.getByText("Waiting for confirmation")).toBeVisible();

  // The grantor confirms after checking the fingerprint.
  await openSettings(page, "emergency");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByTestId("grantee-fingerprint")).toHaveText(/^(\d{5} ){11}\d{5}$/);
  await confirm.getByRole("button", { name: "Confirm and share" }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();

  // The grantee asks; the waiting period starts.
  await openSettings(grantee, "emergency");
  await grantee.getByRole("button", { name: "Request emergency access" }).click();
  await grantee.getByRole("dialog").getByRole("button", { name: "Request emergency access" }).click();
  await expect(grantee.getByText(/Access in 7 days/)).toBeVisible();

  // The grantor allows it early.
  await openSettings(page, "emergency");
  await expect(page.getByText(/Access requested\. They get read access on/)).toBeVisible();
  await page.getByRole("button", { name: "Allow now" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Allow now" }).click();
  await expect(page.getByText("Has access")).toBeVisible();

  await openSettings(grantee, "emergency");
  await grantee.getByRole("link", { name: "Open vaults" }).click();
  await expect(grantee.getByRole("heading", { name: `Emergency access: ${grantorEmail}` })).toBeVisible();
  await grantee.getByRole("button", { name: /Insurance/ }).click();
  await grantee.getByRole("button", { name: "Show" }).click();
  await expect(grantee.getByText("policy-123")).toBeVisible();
});
