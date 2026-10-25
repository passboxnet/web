/**
 * Website icons: popular sites come from the icons bundled with the web app
 * and are never requested from the server; other sites go through the
 * server's icon endpoint.
 */
import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

async function signUp(page: Page) {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(`icons-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4).toLowerCase());
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
}

async function addLogin(page: Page, title: string, website: string) {
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: "Login" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("textbox", { name: "Username" }).fill("anna");
  await page.getByLabel("Password", { exact: true }).fill("x9$Lq!2vR#pW7zK@");
  await page.getByRole("textbox", { name: "Website" }).fill(website);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
}

test("bundled icons need no server request, other sites ask the server", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (request) => {
    const match = /\/api\/v1\/icons\/([^/?]+)/.exec(request.url());
    if (match?.[1]) asked.push(decodeURIComponent(match[1]));
  });
  await signUp(page);
  await addLogin(page, "Netflix", "https://www.netflix.com/login");
  await addLogin(page, "Intranet wiki", "https://wiki.unbundled-site.example");

  const netflix = page.getByRole("option", { name: /Netflix/ });
  await expect(netflix.locator("img").first()).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect.poll(() => asked).toContain("wiki.unbundled-site.example");
  expect(asked.filter((domain) => domain.includes("netflix"))).toEqual([]);
  if (process.env.PASSBOX_E2E_SHOTS) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: `${process.env.PASSBOX_E2E_SHOTS}/web-bundled-icon.png` });
  }
});
