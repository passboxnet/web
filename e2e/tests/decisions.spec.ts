/**
 * In the web app: organization recovery is on by
 * default and members are told when they join; guests are free and
 * view-only; members and guests are counted separately.
 * Set PASSBOX_SCREENSHOTS to a directory to save screenshots.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";
const SHOTS = process.env.PASSBOX_SCREENSHOTS;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function newPage(browser: Browser, locale = "en-US"): Promise<Page> {
  const context = await browser.newContext({ locale, viewport: { width: 1280, height: 800 } });
  return context.newPage();
}

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

async function openTeam(page: Page, name: string) {
  await page.getByRole("button", { name: "Family & team" }).click();
  await page.getByRole("button", { name }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

async function invite(owner: Page, email: string, role: "Member" | "Guest"): Promise<string> {
  await owner.getByRole("button", { name: "Invite member" }).first().click();
  await owner.getByLabel("Email", { exact: true }).fill(email);
  if (role === "Guest") await owner.getByRole("radio", { name: /^Guest/ }).check();
  await owner.getByRole("button", { name: "Create invitation" }).click();
  const link = (await owner.getByTestId("org-invite-link").textContent())?.trim() ?? "";
  await owner.getByRole("button", { name: "Done" }).click();
  return link;
}

async function joinTeam(browser: Browser, link: string, email: string): Promise<Page> {
  const page = await newPage(browser);
  await page.goto(link);
  await createAccount(page, email);
  return page;
}

async function confirm(owner: Page, email: string) {
  await owner
    .getByTestId("org-member")
    .filter({ hasText: email })
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  const dialog = owner.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

test("recovery by default with consent, and a view-only guest", async ({ browser }) => {
  test.setTimeout(240_000);
  const team = "Agency";
  const ownerEmail = uniqueEmail("owner");
  const memberEmail = uniqueEmail("member");
  const guestEmail = uniqueEmail("guest");

  // Creating a team says that recovery is on.
  const owner = await newPage(browser);
  await owner.goto("/");
  await owner.locator("fieldset").getByText("Create account").click();
  await createAccount(owner, ownerEmail);
  await owner.getByRole("button", { name: "Family & team" }).click();
  await owner.getByRole("button", { name: "Create a team" }).first().click();
  await owner.getByLabel("Team name").fill(team);
  await expect(owner.getByTestId("create-org-recovery")).toContainText("Account recovery is on");
  await shot(owner, "en-create-team-recovery-on");
  await owner.getByRole("button", { name: "Create team" }).click();
  await expect(owner.getByRole("heading", { name: team, level: 1 })).toBeVisible();

  const memberLink = await invite(owner, memberEmail, "Member");
  const guestLink = await invite(owner, guestEmail, "Guest");

  // The member is told before accepting that the admins can restore access.
  const member = await joinTeam(browser, memberLink, memberEmail);
  await expect(member.getByTestId("invite-recovery-note")).toContainText("admins can restore your access");
  await shot(member, "en-invitation-recovery-consent");
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(member.getByRole("heading", { name: "Waiting for confirmation" })).toBeVisible();

  // The guest is told what a guest can do, and nothing about recovery.
  const guest = await joinTeam(browser, guestLink, guestEmail);
  await expect(guest.getByTestId("invite-guest-note")).toContainText("You cannot create or change anything");
  await expect(guest.getByTestId("invite-recovery-note")).toHaveCount(0);
  await shot(guest, "en-invitation-guest");
  await guest.getByRole("button", { name: "Accept invitation" }).click();
  await expect(guest.getByRole("heading", { name: "Waiting for confirmation" })).toBeVisible();

  await owner.reload();
  await unlock(owner);
  await openTeam(owner, team);
  await confirm(owner, memberEmail);
  await confirm(owner, guestEmail);

  // A shared vault with an item, shared with the guest: only "View" is offered.
  await owner.getByRole("button", { name: "New shared vault" }).first().click();
  await owner.getByRole("dialog").getByLabel("Name").fill("Client X");
  await owner.getByRole("button", { name: "Create vault" }).click();
  // Creating the vault opens its sharing dialog.
  const share = owner.getByRole("dialog", { name: "Who has access to “Client X”" });
  await expect(share).toBeVisible({ timeout: 30_000 });
  await share.getByLabel("Person or group").selectOption({ label: guestEmail });
  await expect(share.getByLabel("Permission")).toBeDisabled();
  await expect(share.getByLabel("Permission")).toHaveValue("view");
  await expect(share).toContainText("Guests can only view.");
  await shot(owner, "en-share-with-guest-view-only");
  await share.getByRole("button", { name: "Add" }).click();
  await expect(owner.getByText(`${guestEmail} can now open “Client X”.`)).toBeVisible({ timeout: 30_000 });
  await owner.keyboard.press("Escape");

  await owner
    .getByRole("navigation")
    .getByRole("button", { name: /Client X/ })
    .click();
  await owner.getByRole("button", { name: "New item" }).click();
  await owner.getByRole("menuitem", { name: "Login" }).click();
  await owner.getByLabel("Title").fill("CMS");
  await owner.getByLabel("Password", { exact: true }).fill("cms-secret-1");
  await owner.getByRole("button", { name: "Save", exact: true }).click();
  await expect(owner.getByRole("heading", { name: "CMS", level: 2 })).toBeVisible();

  // The guest opens the item, can copy it, and sees why nothing can be changed.
  await guest.reload();
  await unlock(guest);
  await guest
    .getByRole("navigation")
    .getByRole("button", { name: /Client X/ })
    .click();
  await guest.getByRole("option", { name: /CMS/ }).click();
  await expect(guest.getByTestId("guest-view-only")).toContainText("You are a guest.");
  await expect(guest.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
  await shot(guest, "en-guest-item");

  // Admin console: members and guests counted separately.
  await openTeam(owner, team);
  await owner.getByRole("button", { name: "Open admin console" }).click();
  await expect(owner.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await shot(owner, "en-admin-overview-members-guests");
  await owner
    .getByRole("navigation", { name: "Admin console sections" })
    .getByRole("button", { name: "Members" })
    .click();
  await expect(owner.getByTestId("member-counts")).toContainText("2 members · 1 guest");
  await shot(owner, "en-admin-members-counts");

  // German: the guest's view and the member's recovery settings.
  await guest.evaluate(() => {
    const raw = localStorage.getItem("passbox.preferences");
    localStorage.setItem("passbox.preferences", JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), language: "de" }));
  });
  await guest.reload();
  await guest.getByLabel("Master-Passwort", { exact: true }).fill(PASSWORD);
  await guest.getByRole("button", { name: "Entsperren" }).click();
  await guest
    .getByRole("navigation")
    .getByRole("button", { name: /Client X/ })
    .click();
  await guest.getByRole("option", { name: /CMS/ }).click();
  await expect(guest.getByTestId("guest-view-only")).toContainText("Sie sind Gast.");
  await shot(guest, "de-guest-item");
});
