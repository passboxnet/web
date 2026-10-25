/**
 * Breached websites: a breach catalogue (answered by a fake in the browser,
 * so nothing reaches Have I Been Pwned) brings a breach of a saved site →
 * the banner and the finding appear → changing the password resolves it.
 */
import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

async function signUp(page: Page) {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(`breaches-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4).toLowerCase());
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Serves `/api/v1/breaches/catalog*` from the test; 404 until `publish` is called. */
async function fakeCatalog(page: Page) {
  let publishedAt = 0;
  const doc = () => ({
    version: `e2e-${publishedAt}`,
    updatedAt: publishedAt,
    source: "Have I Been Pwned",
    sourceUrl: "https://haveibeenpwned.com/",
    license: "CC BY 4.0",
    breaches: [
      {
        name: "Netflix",
        title: "Netflix",
        domain: "netflix.com",
        breachDate: iso(publishedAt).slice(0, 10),
        addedDate: iso(publishedAt),
        modifiedDate: iso(publishedAt),
        pwnCount: 4_200_000,
        dataClasses: ["Email addresses", "Passwords"],
        verified: true,
        sensitive: false,
      },
    ],
  });
  await page.route("**/api/v1/breaches/catalog**", async (route) => {
    if (publishedAt === 0) return route.fulfill({ status: 404, json: { error: "not_found" } });
    const body = doc();
    if (route.request().url().endsWith("/version")) {
      return route.fulfill({ json: { ...body, breaches: undefined, entries: 1, bundled: false } });
    }
    return route.fulfill({ json: body, headers: { etag: `"${body.version}"` } });
  });
  return {
    publish(at: number) {
      publishedAt = at;
    },
  };
}

test("a newly published breach of a saved site shows up and is resolved by a new password", async ({ page }) => {
  const catalog = await fakeCatalog(page);
  await signUp(page);
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: "Login" }).click();
  await page.getByLabel("Title").fill("Netflix");
  await page.getByRole("textbox", { name: "Username" }).fill("anna@example.com");
  await page.getByLabel("Password", { exact: true }).fill("x9$Lq!2vR#pW7zK@");
  await page.getByRole("textbox", { name: "Website" }).fill("https://www.netflix.com");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Netflix", level: 2 })).toBeVisible();

  // The breach is published after the login was saved; the app picks the
  // new catalogue up at the next unlock.
  const publishedAt = Date.now() + 2000;
  catalog.publish(publishedAt);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();

  const banner = page.getByRole("status").filter({ hasText: "New data breach at Netflix" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("1 of your logins is affected.");
  await banner.getByRole("button", { name: "Show" }).click();
  await expect(banner).toBeHidden();

  await expect(page.getByRole("img", { name: /Security score \d+ of 100/ })).toBeVisible();
  await page.getByRole("button", { name: "Breached website: 1" }).click();
  await expect(page.getByRole("heading", { name: /Breached website/ })).toBeVisible();
  await expect(
    page.getByText(/Netflix had a data breach on .+ \(Passwords, Email addresses\)\. Your password is older\./),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Open website/ })).toHaveAttribute(
    "href",
    "https://www.netflix.com/.well-known/change-password",
  );
  // The facts and the source.
  const facts = page.getByRole("region", { name: "About these breaches" });
  await expect(facts).toContainText("4,200,000 accounts");
  await expect(facts).toContainText("1 affected, 0 fixed");
  await expect(facts.getByRole("link", { name: /Have I Been Pwned/ })).toHaveAttribute(
    "href",
    "https://haveibeenpwned.com/",
  );

  // Change the password after the breach was published: resolved.
  await page.waitForTimeout(Math.max(0, publishedAt - Date.now() + 200));
  await page.getByRole("button", { name: "Change password" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Yes, save" }).click();
  await expect(page.getByText(/Netflix had a data breach on/)).toBeHidden();
  await expect(facts).toContainText("0 affected, 1 fixed");
});
