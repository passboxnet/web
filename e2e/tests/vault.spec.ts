import { type Browser, expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

function uniqueEmail() {
  return `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page, email: string): Promise<string> {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await expect(page.getByRole("radio", { name: "Create account" })).toBeChecked();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  expect(secretKey).toMatch(/^P1-[0-9A-Z]{5}(-[0-9A-Z]{5}){3}-[0-9A-Z]{6}$/);
  await page.getByLabel("I have saved my Emergency Kit").check();
  await page.getByRole("button", { name: "Open my vault" }).click();
  await expect(page.getByText("Your vault is empty")).toBeVisible();
  return secretKey;
}

async function newItem(page: Page, type: "Login" | "Secure note") {
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: type }).click();
}

async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

async function signIn(page: Page, email: string, secretKey: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Secret Key").fill(secretKey);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("sign up, store a login with TOTP, lock and unlock", async ({ page }) => {
  await signUp(page, uniqueEmail());

  await newItem(page, "Login");
  await page.getByLabel("Title").fill("GitHub");
  await page.getByRole("textbox", { name: "Username" }).fill("octocat");
  await page.getByRole("button", { name: "Generate password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(/.{24}/);
  await page.getByRole("textbox", { name: "Website" }).fill("github.com");
  await page
    .getByRole("textbox", { name: "One-time password" })
    .fill("otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByRole("heading", { name: "GitHub", level: 2 })).toBeVisible();
  await expect(page.getByText(/^\d{3} \d{3}$/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
  await page.getByLabel("Master password", { exact: true }).fill("not my password");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");

  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("option", { name: /GitHub/ })).toBeVisible();
});

test("a second device signs in with the Secret Key and changes sync back", async ({ page, browser }) => {
  const email = uniqueEmail();
  const secretKey = await signUp(page, email);
  await newItem(page, "Secure note");
  await page.getByLabel("Title").fill("Wi-Fi");
  await page.getByLabel("Notes").fill("Network: Home");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Wi-Fi", level: 2 })).toBeVisible();

  const phone = await newDevice(browser);
  // Secret Key input is forgiving: lowercase and spaces work too.
  await signIn(phone, email.toUpperCase(), secretKey.toLowerCase().replaceAll("-", " "));
  await phone.getByRole("option", { name: /Wi-Fi/ }).click();
  await phone.getByRole("button", { name: /^Edit/ }).click();
  await phone.getByLabel("Title").fill("Home Wi-Fi");
  await phone.getByRole("button", { name: "Save", exact: true }).click();
  await expect(phone.getByRole("heading", { name: "Home Wi-Fi", level: 2 })).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("option", { name: /Home Wi-Fi/ })).toBeVisible();

  await page.getByRole("option", { name: /Home Wi-Fi/ }).click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete item" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete item" }).click();
  await expect(page.getByText("Your vault is empty")).toBeVisible();
});

test("Watchtower flags weak and reused passwords", async ({ page }) => {
  await signUp(page, uniqueEmail());
  for (const title of ["Shop A", "Shop B"]) {
    await newItem(page, "Login");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Password", { exact: true }).fill("summer2024");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
  }
  await expect(page.getByText("This password is weak.")).toBeVisible();
  await page.getByRole("button", { name: /Watchtower/ }).click();
  await expect(page.getByRole("heading", { name: "Watchtower", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Reused passwords/ })).toContainText("2");
});

test("a wrong Secret Key is rejected", async ({ page, browser }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  const stranger = await newDevice(browser);
  await signIn(stranger, email, "P1-00000-00000-00000-00000-000000");
  await expect(stranger.getByRole("alert")).toContainText("incorrect");
});

test("a different server address works across origins", async ({ page, baseURL }) => {
  // The app is served from 127.0.0.1; localhost is another origin for the
  // browser, so this goes through the server's CORS support like the desktop app.
  const port = new URL(baseURL ?? "").port;
  const other = `http://localhost:${port}`;
  await page.goto("/");
  await expect(page.getByText(`127.0.0.1:${port} · v`)).toBeVisible();
  await page.getByRole("button", { name: "Use a different server" }).click();
  await page.getByLabel("Server address").fill("ftp://example.com");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("alert")).toContainText("https://");
  await page.getByLabel("Server address").fill(other);
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText(`localhost:${port} · v`)).toBeVisible();

  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(other, { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("I have saved my Emergency Kit").check();
  await page.getByRole("button", { name: "Open my vault" }).click();
  await newItem(page, "Secure note");
  await page.getByLabel("Title").fill("Cross-origin");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cross-origin", level: 2 })).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/settings";
  });
  await expect(page.getByText(`localhost:${port}`, { exact: true })).toBeVisible();
});
