import { type Browser, expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

function uniqueEmail() {
  return `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Confirms the Emergency Kit by typing the last 4 characters of the Secret Key. */
async function confirmKit(page: Page, secretKey: string) {
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4).toLowerCase());
  await page.getByRole("button", { name: "Continue to my vault" }).click();
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
  await confirmKit(page, secretKey);
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
  return secretKey;
}

async function newItem(page: Page, type: "Login" | "Secure note") {
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: type }).click();
}

async function newDevice(browser: Browser, locale = "en-US"): Promise<Page> {
  const context = await browser.newContext({ locale });
  return context.newPage();
}

async function signIn(page: Page, email: string, secretKey: string) {
  await page.goto("/");
  // A device that has never been used opens "Create account".
  await page.locator("fieldset").getByText("Sign in", { exact: true }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Secret Key").fill(secretKey);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function unlock(page: Page, password = PASSWORD) {
  await page.getByLabel("Master password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Unlock" }).click();
}

test("sign up, store a login with TOTP, lock and unlock", async ({ page }) => {
  await signUp(page, uniqueEmail());

  await newItem(page, "Login");
  await page.getByLabel("Title").fill("GitHub");
  await page.getByRole("textbox", { name: "Username" }).fill("octocat");
  await page.getByRole("button", { name: "Create a strong password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(/.{24}/);
  await page.getByRole("textbox", { name: "Website" }).fill("github.com");
  // A single code instead of the setup key is caught before saving.
  await page.getByRole("textbox", { name: "Two-factor code (2FA)" }).fill("482913");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("This is a single code, not the setup key.")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Two-factor code (2FA)" })
    .fill("otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByRole("heading", { name: "GitHub", level: 2 })).toBeVisible();
  await expect(page.getByText(/^\d{3} \d{3}$/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
  await unlock(page, "not my password");
  // Only the master password is typed here, so the message names only it.
  await expect(page.getByRole("alert")).toContainText("Wrong master password");

  await unlock(page);
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
  // Lists never show what a secure note says.
  await expect(page.getByRole("option", { name: /Wi-Fi/ })).toContainText("Secure note · 1 line");

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
});

test("moving to the trash can be undone, restored or made permanent", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await newItem(page, "Secure note");
  await page.getByLabel("Title").fill("Bank PIN");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bank PIN", level: 2 })).toBeVisible();

  // Move to trash, then Undo from the toast.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("option", { name: /Bank PIN/ })).toBeVisible();

  // Move to trash again, restore it from the trash view.
  await page.getByRole("option", { name: /Bank PIN/ }).click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await page.getByRole("button", { name: /^Trash/ }).click();
  await expect(page.getByRole("heading", { name: "Trash", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("The trash is empty")).toBeVisible();

  // And once more, deleting it for good after a confirmation.
  await page.getByRole("button", { name: /^All items/ }).click();
  await page.getByRole("option", { name: /Bank PIN/ }).click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await page.getByRole("button", { name: /^Trash/ }).click();
  await expect(page.getByRole("heading", { name: "Trash", level: 1 })).toBeVisible();
  await expect(page.getByText("Bank PIN", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("The trash is empty")).toBeVisible();
});

test("the Emergency Kit comes back until it is confirmed", async ({ page }) => {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";

  // A reload during the kit shows it again after unlocking.
  await page.reload();
  await unlock(page);
  await expect(page.getByTestId("secret-key")).toHaveText(secretKey);

  // A wrong check is rejected; "Do this later" leaves a reminder.
  await page.getByLabel(/last 4 characters/).fill("0000");
  await expect(page.getByText("That doesn't match.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to my vault" })).toBeDisabled();
  await page.getByRole("button", { name: "Do this later" }).click();
  await expect(page.getByText("Emergency Kit not saved yet")).toBeVisible();

  // The reminder asks for the master password before showing the kit.
  await page.getByRole("button", { name: "Save it now" }).first().click();
  await page.getByRole("dialog").getByLabel("Master password", { exact: true }).fill("wrong password");
  await page.getByRole("dialog").getByRole("button", { name: "Show Emergency Kit" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Wrong master password");
  await page.getByRole("dialog").getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("dialog").getByRole("button", { name: "Show Emergency Kit" }).click();
  await confirmKit(page, secretKey);
  await expect(page.getByText("Emergency Kit not saved yet")).toHaveCount(0);

  // Once confirmed, unlocking goes straight to the vault.
  await page.reload();
  await unlock(page);
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
});

test("signing out asks first and names the Emergency Kit", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.reload();
  await page.getByRole("button", { name: "Use a different account…" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("To sign in again you need your Emergency Kit");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();

  await page.getByRole("button", { name: "Forgot your master password?" }).click();
  await expect(page.getByRole("dialog")).toContainText("Passbox can't reset it");
  await page.getByRole("button", { name: "Got it" }).click();

  await page.getByRole("button", { name: "Use a different account…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Passbox" })).toBeVisible();
});

test("the security check flags weak and reused passwords", async ({ page }) => {
  await signUp(page, uniqueEmail());
  for (const title of ["Shop A", "Shop B"]) {
    await newItem(page, "Login");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Password", { exact: true }).fill("summer2024");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
  }
  await expect(page.getByText("This password is easy to guess.")).toBeVisible();
  await page.getByRole("button", { name: /Security check/ }).click();
  await expect(page.getByRole("heading", { name: "Security check", level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: /Security score \d+ of 100/ })).toBeVisible();
  await expect(page.getByText(/−\d+ Used more than once/)).toBeVisible();
  await expect(page.getByText(/−\d+ Easy to guess/)).toBeVisible();
});

test("a wrong or malformed Secret Key is rejected", async ({ page, browser }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  const stranger = await newDevice(browser);
  await signIn(stranger, email, "P1-00000-00000-00000");
  await expect(stranger.getByRole("alert")).toContainText("The Secret Key is incomplete");
  await stranger.getByLabel("Secret Key").fill("hello");
  await stranger.getByRole("button", { name: "Sign in" }).click();
  await expect(stranger.getByRole("alert")).toContainText("doesn't look like a Secret Key");
  await stranger.getByLabel("Secret Key").fill("P1-00000-00000-00000-00000-000000");
  await stranger.getByRole("button", { name: "Sign in" }).click();
  await expect(stranger.getByRole("alert")).toContainText("incorrect");
});

test("German is the default for German browsers", async ({ browser }) => {
  const page = await newDevice(browser, "de-DE");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { name: "Konto erstellen" })).toBeVisible();
  await expect(page.getByText("Der Passwortmanager, der Freude macht.")).toBeVisible();
  await page.getByLabel("E-Mail").fill(uniqueEmail());
  await page.getByLabel("Master-Passwort", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Master-Passwort wiederholen").fill(PASSWORD);
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("heading", { name: "Notfall-Kit – gut aufbewahren!" })).toBeVisible({ timeout: 30_000 });
  const secretKey = (await page.getByTestId("secret-key").textContent())?.trim() ?? "";
  await page.getByLabel(/letzten 4 Zeichen/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Weiter zu meinem Tresor" }).click();
  await expect(page.getByText("Noch keine Passwörter gespeichert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sicherheits-Check", exact: true })).toBeVisible();

  // The language can be switched in Settings.
  await page
    .getByRole("button", { name: /^Einstellungen/ })
    .first()
    .click();
  await page.locator("fieldset").getByText("English").click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("a different server address works across origins", async ({ page, baseURL }) => {
  // The app is served from 127.0.0.1; localhost is another origin for the
  // browser, so this goes through the server's CORS support like the desktop app.
  const port = new URL(baseURL ?? "").port;
  const other = `http://localhost:${port}`;
  await page.goto("/");
  await expect(page.getByText(`127.0.0.1:${port} · v`)).toBeVisible();
  await page.getByText("Advanced").click();
  await page.getByRole("button", { name: "Use a different server" }).click();
  await page.getByLabel("Server address").fill("ftp://example.com");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("alert")).toContainText("https://");
  await page.getByLabel("Server address").fill("http://192.168.1.20:8080");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("alert")).toContainText("only allowed for a server on this computer");
  await page.getByLabel("Server address").fill(other);
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText(`localhost:${port} · v`)).toBeVisible();

  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(other, { exact: true })).toBeVisible({ timeout: 30_000 });
  const secretKey = (await page.getByTestId("secret-key").textContent())?.trim() ?? "";
  await confirmKit(page, secretKey);
  await newItem(page, "Secure note");
  await page.getByLabel("Title").fill("Cross-origin");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cross-origin", level: 2 })).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/settings";
  });
  await expect(page.getByText(`localhost:${port}`, { exact: true })).toBeVisible();
});
