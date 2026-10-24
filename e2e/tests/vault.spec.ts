import { type Browser, expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

function uniqueEmail() {
  return `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page, email: string): Promise<string> {
  await page.goto("/");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  expect(secretKey).toMatch(/^P1-[0-9A-Z]{5}(-[0-9A-Z]{5}){3}-[0-9A-Z]{6}$/);
  await page.getByLabel("I have saved my Emergency Kit").check();
  await page.getByRole("button", { name: "Open my vault" }).click();
  await expect(page.getByText("No items yet")).toBeVisible();
  return secretKey;
}

async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

async function signIn(page: Page, email: string, secretKey: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password").fill(PASSWORD);
  await page.getByLabel("Secret Key").fill(secretKey);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("sign up, store a login with TOTP, lock and unlock", async ({ page }) => {
  await signUp(page, uniqueEmail());

  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByLabel("Title").fill("GitHub");
  await page.getByLabel("Username").fill("octocat");
  await page.getByRole("button", { name: "Generate password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(/.{24}/);
  await page.getByLabel("Website").fill("github.com");
  await page.getByLabel("One-time password").fill("otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible();
  await expect(page.getByText(/^\d{3} \d{3}$/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
  await page.getByLabel("Master password").fill("not my password");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");

  await page.getByLabel("Master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("button", { name: /GitHub/ })).toBeVisible();
});

test("a second device signs in with the Secret Key and changes sync back", async ({ page, browser }) => {
  const email = uniqueEmail();
  const secretKey = await signUp(page, email);
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("button", { name: "Secure note" }).click();
  await page.getByLabel("Title").fill("Wi-Fi");
  await page.getByLabel("Notes").fill("Network: Home");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Wi-Fi" })).toBeVisible();

  const phone = await newDevice(browser);
  // Secret Key input is forgiving: lowercase and spaces work too.
  await signIn(phone, email.toUpperCase(), secretKey.toLowerCase().replaceAll("-", " "));
  await phone.getByRole("button", { name: /Wi-Fi/ }).click();
  await phone.getByRole("button", { name: "Edit" }).click();
  await phone.getByLabel("Title").fill("Home Wi-Fi");
  await phone.getByRole("button", { name: "Save" }).click();
  await expect(phone.getByRole("heading", { name: "Home Wi-Fi" })).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: /Home Wi-Fi/ })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Home Wi-Fi/ }).click();
  await page.getByRole("button", { name: "Delete item" }).click();
  await expect(page.getByText("No items yet")).toBeVisible();
});

test("a wrong Secret Key is rejected", async ({ page, browser }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  const stranger = await newDevice(browser);
  await signIn(stranger, email, "P1-00000-00000-00000-00000-000000");
  await expect(stranger.getByRole("alert")).toContainText("incorrect");
});
