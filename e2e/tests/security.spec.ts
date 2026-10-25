/**
 * The security check dashboard: score, fix-first list, drill-down with
 * dismiss and restore, and the alias setup in the generator. The breach
 * check is not started here (it would reach Have I Been Pwned).
 */
import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

async function signUp(page: Page) {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(`security-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4).toLowerCase());
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
}

async function addLogin(page: Page, title: string, password: string, website: string) {
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: "Login" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("textbox", { name: "Username" }).fill("anna");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("textbox", { name: "Website" }).fill(website);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
}

test("security check dashboard with drill-down, dismiss and restore", async ({ page }) => {
  await signUp(page);
  await addLogin(page, "Mail", "x9$Lq!2vR#pW7zK@", "https://mail.example.com");
  await addLogin(page, "Intranet", "x9$Lq!2vR#pW7zK@", "http://intranet.example.com");

  await page.getByRole("button", { name: /^Security check/ }).click();
  await expect(page.getByRole("img", { name: /Security score \d+ of 100/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fix these first" })).toBeVisible();
  await expect(page.getByText(/−\d+ Used more than once/)).toBeVisible();

  // Drill down into reused passwords and dismiss one finding.
  await page.getByRole("button", { name: "Used more than once: 2" }).click();
  await expect(page.getByRole("heading", { name: /Used more than once/ })).toBeVisible();
  await expect(page.getByText("Also used in: Intranet")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss for Mail" }).click();
  await expect(page.getByText("Finding dismissed. It no longer counts for the score.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dismissed (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Show again" }).click();
  await expect(page.getByRole("heading", { name: "Dismissed (1)" })).toBeHidden();
  await page.getByRole("button", { name: "All checks" }).click();

  // Settings and email monitoring (not configured on the test server).
  await expect(page.getByText(/Not set up on this server/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Automatic" })).toBeChecked();

  // Email aliases in the generator.
  await page.getByRole("button", { name: "Password generator" }).click();
  await expect(page.getByRole("heading", { name: "Email alias" })).toBeVisible();
  const providers = page.getByRole("radiogroup", { name: "Alias service" });
  await expect(providers.getByRole("radio", { name: "SimpleLogin" })).toBeChecked();
  await providers.getByRole("radio", { name: "addy.io" }).click();
  await expect(providers.getByRole("radio", { name: "addy.io" })).toBeChecked();
  // The services' own icons are bundled with the app.
  await expect(providers.locator("img").first()).toHaveAttribute("src", /^data:image\/png|simplelogin.*\.png$/);
});
