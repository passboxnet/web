import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";
const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "packages",
  "client",
  "src",
  "import",
  "fixtures",
);

async function signUp(page: Page) {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(`import-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByTestId("secret-key").waitFor({ timeout: 30_000 });
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /Open my vault/ }).click();
}

async function importChrome(page: Page) {
  await page.goto("/#/import");
  await page.getByRole("radio", { name: "Chrome" }).click();
  await expect(page.getByRole("heading", { name: "How to export from Chrome" })).toBeVisible();
  await page.getByTestId("import-file-input").setInputFiles(join(FIXTURES, "chrome.csv"));
  await expect(page.getByRole("heading", { name: "3 items found in chrome.csv" })).toBeVisible();
}

test("imports a Chrome CSV file and finds the items", async ({ page }) => {
  await signUp(page);
  await importChrome(page);
  await expect(page.getByText("No duplicates")).toBeVisible();
  await expect(page.getByRole("cell", { name: "alice@example.com" })).toBeVisible();
  await page.getByRole("button", { name: "Import 3 items" }).click();

  await expect(page.getByRole("heading", { name: "Import finished" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("3 added")).toBeVisible();
  await expect(page.getByText("Delete the CSV file now – it contains your passwords unencrypted.")).toBeVisible();

  await page.getByRole("button", { name: "Show my items" }).click();
  for (const title of ["example.com", "Intranet", "shop.example.net"]) {
    await expect(page.getByRole("option", { name: new RegExp(title) })).toBeVisible();
  }

  // Importing the same file again finds the duplicates and skips them by default.
  await importChrome(page);
  await expect(page.getByRole("heading", { name: "3 items already exist in Passbox" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import 0 items" })).toBeDisabled();
});

test("exports an encrypted file and a CSV file from Settings", async ({ page }) => {
  await signUp(page);
  await importChrome(page);
  await page.getByRole("button", { name: "Import 3 items" }).click();
  await expect(page.getByRole("heading", { name: "Import finished" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Export data" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Export password", { exact: true }).fill("tidy-lantern-orbit-mossy-9");
  await dialog.getByLabel("Repeat export password").fill("tidy-lantern-orbit-mossy-9");
  await dialog.getByLabel("Master password").fill("wrong master password");
  await dialog.getByRole("button", { name: "Export" }).click();
  await expect(dialog.getByText("The master password is wrong")).toBeVisible({ timeout: 30_000 });

  await dialog.getByLabel("Master password").fill(PASSWORD);
  const encrypted = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export" }).click();
  const file = await encrypted;
  expect(file.suggestedFilename()).toMatch(/^passbox-export-\d{4}-\d{2}-\d{2}\.pbx-export$/);
  const envelope = JSON.parse(await readFile((await file.path()) ?? "", "utf8"));
  expect(envelope).toMatchObject({ format: "passbox-export", version: 1 });

  await page.getByRole("button", { name: "Export data" }).click();
  await dialog.getByText("CSV file (not encrypted)").click();
  await dialog.getByLabel("Master password").fill(PASSWORD);
  await expect(dialog.getByRole("button", { name: "Export" })).toBeDisabled();
  await dialog.getByLabel("I understand that the file is not encrypted.").check();
  const csv = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export" }).click();
  const text = await readFile((await (await csv).path()) ?? "", "utf8");
  expect(text.split("\r\n")[0]).toBe(
    "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp",
  );
  expect(text).toContain("Correct-Horse-7");
});
