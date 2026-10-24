import { type Browser, expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: "en-US" });
  return context.newPage();
}

/** Creates an account on the page that is already open (sign-up form) and confirms the Emergency Kit. */
async function createAccount(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).last().click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();
}

async function unlock(page: Page) {
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
}

async function openFamily(page: Page, name: string) {
  await page.getByRole("button", { name: "Family & team" }).click();
  await page.getByRole("button", { name }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test("a family shares a vault, confirms a member and removes her again", async ({ browser }) => {
  test.setTimeout(180_000);
  const family = "The Millers";
  const ownerEmail = uniqueEmail("michael");
  const annaEmail = uniqueEmail("anna");

  // The owner signs up, starts a family and invites Anna.
  const owner = await newPage(browser);
  await owner.goto("/");
  await owner.locator("fieldset").getByText("Create account").click();
  await createAccount(owner, ownerEmail);
  await owner.getByRole("button", { name: "Family & team" }).click();
  await owner.getByRole("button", { name: "Start a family" }).first().click();
  await owner.getByLabel("Family name").fill(family);
  await owner.getByRole("button", { name: "Start family" }).click();
  await expect(owner.getByRole("heading", { name: family, level: 1 })).toBeVisible();
  await expect(owner.getByRole("navigation").getByRole("button", { name: /Family vault/ })).toBeVisible();

  await owner.getByRole("button", { name: "Invite family member" }).click();
  await owner.getByLabel("Email", { exact: true }).fill(annaEmail);
  await owner.getByRole("button", { name: "Create invitation" }).click();
  const link = (await owner.getByTestId("org-invite-link").textContent())?.trim() ?? "";
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]+#org=[A-Za-z0-9_-]+$/);
  await owner.getByRole("button", { name: "Done" }).click();
  await expect(owner.getByTestId("org-invitation")).toContainText(annaEmail);

  // Anna opens the link, creates her account with the invited address and accepts.
  const anna = await newPage(browser);
  await anna.goto(link);
  await expect(anna.getByTestId("org-invite-notice")).toContainText(`${ownerEmail} invites you to their family`);
  // The address bar no longer shows the token.
  expect(new URL(anna.url()).pathname).toBe("/");
  await expect(anna.getByLabel("Email")).toHaveValue(annaEmail);
  await createAccount(anna, annaEmail);
  await expect(anna.getByRole("dialog")).toContainText("Your role: Family member");
  await anna.getByRole("button", { name: "Accept invitation" }).click();
  await expect(anna.getByRole("heading", { name: "Waiting for confirmation" })).toBeVisible();
  // The security code: 12 groups of five digits.
  const annaCode = ((await anna.getByTestId("security-code").textContent()) ?? "").match(/\d{5}(?: \d{5}){11}/)?.[0];
  expect(annaCode).toBeTruthy();

  // The owner confirms Anna after seeing the same security code.
  await owner.reload();
  await unlock(owner);
  await openFamily(owner, family);
  await expect(owner.getByTestId("org-member").filter({ hasText: annaEmail })).toContainText(
    "Waiting for confirmation",
  );
  await owner.getByRole("button", { name: "Confirm", exact: true }).click();
  const dialog = owner.getByRole("dialog");
  await expect(dialog.getByTestId("security-code").first()).toContainText(annaCode ?? "");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(owner.getByTestId("org-member").filter({ hasText: annaEmail })).not.toContainText("Waiting");

  // The owner adds a login to the family vault.
  await owner
    .getByRole("navigation")
    .getByRole("button", { name: /Family vault/ })
    .click();
  await owner.getByRole("button", { name: "New item" }).click();
  await owner.getByRole("menuitem", { name: "Login" }).click();
  await expect(owner.getByTestId("editor-audience")).toContainText(`Visible to: ${family} (2)`);
  await owner.getByLabel("Title").fill("Netflix");
  await owner.getByRole("textbox", { name: "Username" }).fill("family@example.com");
  await owner.getByLabel("Password", { exact: true }).fill("family-secret-1");
  await owner.getByRole("button", { name: "Save", exact: true }).click();
  await expect(owner.getByTestId("item-audience")).toContainText(`Visible to: ${family} (2)`);

  // Anna sees the family vault and changes the item.
  await anna.getByRole("button", { name: "Check now" }).click();
  await anna
    .getByRole("navigation")
    .getByRole("button", { name: /Family vault/ })
    .click();
  await anna.getByRole("option", { name: /Netflix/ }).click();
  await anna.getByRole("button", { name: /^Edit/ }).click();
  await anna.getByLabel("Password", { exact: true }).fill("changed-by-anna-2");
  await anna.getByRole("button", { name: "Save", exact: true }).click();
  await expect(anna.getByRole("heading", { name: "Netflix", level: 2 })).toBeVisible();

  await owner.reload();
  await unlock(owner);
  await owner
    .getByRole("navigation")
    .getByRole("button", { name: /Family vault/ })
    .click();
  await owner.getByRole("option", { name: /Netflix/ }).click();
  await owner.getByRole("button", { name: "Show Password" }).click();
  await expect(owner.getByText("changed-by-anna-2")).toBeVisible();

  // View only: Anna can no longer edit.
  await owner.getByTestId("item-audience").click();
  await owner.getByRole("dialog").getByLabel(`Permission for ${annaEmail}`).selectOption("view");
  await expect(owner.getByText(`${annaEmail}: View.`)).toBeVisible({ timeout: 30_000 });
  await owner.keyboard.press("Escape");
  await anna.reload();
  await unlock(anna);
  await anna
    .getByRole("navigation")
    .getByRole("button", { name: /Family vault/ })
    .click();
  await anna.getByRole("option", { name: /Netflix/ }).click();
  await expect(anna.getByText("View only.")).toBeVisible();
  await expect(anna.getByRole("button", { name: /^Edit/ })).toHaveCount(0);

  // The owner removes Anna; the vault gets a new key and Anna loses access.
  await openFamily(owner, family);
  await owner.getByRole("button", { name: `More for ${annaEmail}` }).click();
  await owner.getByRole("menuitem", { name: "Remove…" }).click();
  await expect(owner.getByRole("dialog")).toContainText("loses access immediately");
  await owner.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(owner.getByRole("heading", { name: `${annaEmail} was removed` })).toBeVisible({ timeout: 60_000 });
  await owner.getByRole("button", { name: "Done" }).click();
  await expect(owner.getByTestId("org-member")).toHaveCount(1);

  await anna.reload();
  await unlock(anna);
  await anna.getByRole("button", { name: "All items" }).click();
  await expect(anna.getByRole("heading", { name: "All items" })).toBeVisible();
  await expect(anna.getByRole("navigation").getByRole("button", { name: /Family vault/ })).toHaveCount(0);
  await expect(anna.getByRole("option", { name: /Netflix/ })).toHaveCount(0);
  await anna.getByRole("button", { name: "Family & team" }).click();
  await expect(anna.getByRole("button", { name: family })).toHaveCount(0);
});

test("an invitation link survives signing in with an existing account", async ({ browser }) => {
  test.setTimeout(120_000);
  const ownerEmail = uniqueEmail("lena");
  const tomEmail = uniqueEmail("tom");

  // Tom already has an account.
  const tom = await newPage(browser);
  await tom.goto("/");
  await tom.locator("fieldset").getByText("Create account").click();
  await createAccount(tom, tomEmail);

  const owner = await newPage(browser);
  await owner.goto("/");
  await owner.locator("fieldset").getByText("Create account").click();
  await createAccount(owner, ownerEmail);
  await owner.getByRole("button", { name: "Family & team" }).click();
  await owner.getByRole("button", { name: "Create a team" }).first().click();
  await owner.getByLabel("Team name").fill("Acme");
  await owner.getByRole("button", { name: "Create team" }).click();
  await owner.getByRole("button", { name: "Invite member" }).click();
  await owner.getByLabel("Email", { exact: true }).fill(tomEmail);
  await owner.getByRole("button", { name: "Create invitation" }).click();
  const link = (await owner.getByTestId("org-invite-link").textContent())?.trim() ?? "";

  // Tom is locked; the invitation waits until he has unlocked.
  await tom.goto(link);
  await unlock(tom);
  await expect(tom.getByRole("dialog")).toContainText(`${ownerEmail} invites you to their team`);
  await tom.getByRole("button", { name: "Accept invitation" }).click();
  await expect(tom.getByRole("heading", { name: "Waiting for confirmation" })).toBeVisible();

  // A link for another address is refused before anything is sent.
  await owner.getByRole("button", { name: "Invite someone else" }).click();
  await owner.getByLabel("Email", { exact: true }).fill(uniqueEmail("other"));
  await owner.getByRole("button", { name: "Create invitation" }).click();
  const other = (await owner.getByTestId("org-invite-link").textContent())?.trim() ?? "";
  await tom.goto(other);
  await unlock(tom);
  await expect(tom.getByRole("alert")).toContainText(`This invitation is for`);
  await expect(tom.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
});
